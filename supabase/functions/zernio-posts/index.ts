// Client-facing publishing bridge for the Zernio provider.
// Handles drafts, immediate publishing, scheduling, status refresh and cancel.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient } from "../_shared/social/store.ts";
import {
  normalizePlatform,
  remoteId,
  toZernioPlatform,
  unwrapList,
  unwrapOne,
  zernio,
  zernioConfigured,
  type ZernioMediaItem,
  type ZernioPost,
} from "../_shared/zernio/client.ts";
import { logZernioEvent, planLimits } from "../_shared/zernio/tenancy.ts";

type Supabase = ReturnType<typeof serviceClient>;

/** Zernio -> TapThatFlyer post status. We never invent "published". */
function mapStatus(remote: unknown, fallback: string) {
  const value = String(remote ?? "").toLowerCase();
  if (["draft", "scheduled", "publishing", "published", "failed"].includes(value)) return value;
  if (value === "partial") return "published";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return fallback;
}

function platformErrors(post: ZernioPost): string | null {
  const targets = Array.isArray(post.platforms) ? post.platforms : [];
  const messages = targets
    .map((t) => {
      const rec = t as Record<string, unknown>;
      const err = rec.error ?? rec.errorMessage ?? rec.failureReason;
      if (!err) return null;
      const platform = normalizePlatform(rec.platform);
      return `${platform}: ${String(err).slice(0, 200)}`;
    })
    .filter(Boolean);
  return messages.length ? messages.join(" • ") : null;
}

async function ownedAccounts(supabase: Supabase, userId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("zernio_accounts")
    .select("id, zernio_account_id, platform, status, account_name, username")
    .eq("user_id", userId)
    .in("id", ids);
  return data ?? [];
}

function sanitizeMedia(input: unknown): ZernioMediaItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      const url = String(item.url ?? "");
      if (!/^https:\/\//i.test(url)) return null;
      const type = String(item.type ?? "image").toLowerCase();
      return {
        type: (["image", "video", "gif", "document"].includes(type) ? type : "image") as
          ZernioMediaItem["type"],
        url,
        ...(item.alt_text ? { altText: String(item.alt_text).slice(0, 900) } : {}),
        ...(item.title ? { title: String(item.title).slice(0, 200) } : {}),
      } satisfies ZernioMediaItem;
    })
    .filter(Boolean) as ZernioMediaItem[];
}

async function refreshPost(supabase: Supabase, row: Record<string, unknown>) {
  const zernioPostId = row.zernio_post_id as string | null;
  if (!zernioPostId) return row;
  const result = await zernio.getPost(zernioPostId);
  if (result.ok === false) return row;
  const remote = unwrapOne<ZernioPost>(result.data, "post");
  const status = mapStatus(remote.status, String(row.status));
  const error = platformErrors(remote);
  const { data: updated } = await supabase
    .from("zernio_posts")
    .update({
      status,
      published_at: remote.publishedAt ?? (row.published_at as string | null),
      last_error: error,
      response: remote as Record<string, unknown>,
    })
    .eq("id", row.id as string)
    .select("*")
    .maybeSingle();
  return updated ?? row;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "list");
  const supabase = serviceClient();

  if (!(await zernioConfigured()) && action !== "list") {
    return json({
      error: "Social publishing is not configured yet. An administrator needs to finish the setup.",
      code: "not_configured",
    }, 400);
  }

  try {
    // ------------------------------------------------------------- list ----
    if (action === "list") {
      const { data } = await supabase
        .from("zernio_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return json({ posts: data ?? [], limits: await planLimits(supabase, user.id) });
    }

    // ----------------------------------------------------------- refresh ---
    if (action === "refresh") {
      const postId = String(body.post_id ?? "");
      const { data: row } = await supabase
        .from("zernio_posts")
        .select("*")
        .eq("id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row) return json({ error: "Post not found." }, 404);
      return json({ post: await refreshPost(supabase, row) });
    }

    // ------------------------------------------------------------ cancel ---
    if (action === "cancel" || action === "delete") {
      const postId = String(body.post_id ?? "");
      const { data: row } = await supabase
        .from("zernio_posts")
        .select("*")
        .eq("id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row) return json({ error: "Post not found." }, 404);
      if (row.zernio_post_id) await zernio.deletePost(row.zernio_post_id as string);
      if (action === "delete") {
        await supabase.from("zernio_posts").delete().eq("id", postId);
        return json({ ok: true, deleted: true });
      }
      const { data: updated } = await supabase
        .from("zernio_posts")
        .update({ status: "cancelled" })
        .eq("id", postId)
        .select("*")
        .maybeSingle();
      return json({ ok: true, post: updated });
    }

    // ------------------------------------------------------------ create ---
    if (action === "create") {
      const mode = String(body.mode ?? "draft"); // draft | publish | schedule
      const content = String(body.content ?? "").trim();
      const title = body.title ? String(body.title).slice(0, 200) : null;
      const media = sanitizeMedia(body.media);
      const accountIds = Array.isArray(body.account_ids) ? body.account_ids.map(String) : [];
      const timezone = String(body.timezone || "UTC");
      const scheduledAt = body.scheduled_at ? new Date(String(body.scheduled_at)) : null;

      if (!content && !media.length) {
        return json({ error: "Write a caption or add media before continuing." }, 400);
      }
      if (mode !== "draft" && !accountIds.length) {
        return json({ error: "Select at least one social account." }, 400);
      }
      if (mode === "schedule") {
        if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
          return json({ error: "Pick a valid date and time to schedule this post." }, 400);
        }
        if (scheduledAt.getTime() < Date.now() + 60_000) {
          return json({ error: "Pick a time at least a minute in the future." }, 400);
        }
      }

      const accounts = await ownedAccounts(supabase, user.id, accountIds);
      if (mode !== "draft" && accounts.length !== accountIds.length) {
        return json({ error: "One of those accounts is no longer available." }, 400);
      }
      const unhealthy = accounts.find((a) => a.status !== "connected");
      if (mode !== "draft" && unhealthy) {
        return json({
          error: `${unhealthy.account_name || unhealthy.platform} needs to be reconnected before you can post.`,
        }, 400);
      }

      // ---- server-side plan enforcement ----------------------------------
      const limits = await planLimits(supabase, user.id);
      if (mode !== "draft") {
        const maxPosts = limits.plan?.max_posts_per_month ?? 0;
        if (maxPosts > 0 && limits.usage.posts_this_month >= maxPosts) {
          return json({
            error: "You've reached your monthly post limit. Upgrade your plan to publish more.",
            code: "limit_reached",
            limits,
          }, 402);
        }
        if (mode === "schedule") {
          const maxScheduled = limits.plan?.max_scheduled_posts ?? 0;
          if (maxScheduled > 0 && limits.usage.scheduled_posts >= maxScheduled) {
            return json({
              error: "You've reached your scheduled post limit. Upgrade your plan to schedule more.",
              code: "limit_reached",
              limits,
            }, 402);
          }
        }
      }

      const { data: profile } = await supabase
        .from("zernio_profiles")
        .select("id, zernio_profile_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      // Local record first, so nothing is ever lost if the remote call fails.
      const { data: local, error: insertError } = await supabase
        .from("zernio_posts")
        .insert({
          user_id: user.id,
          profile_id: profile?.id ?? null,
          zernio_profile_id: profile?.zernio_profile_id ?? null,
          title,
          content,
          media,
          account_ids: accountIds,
          zernio_account_ids: accounts.map((a) => a.zernio_account_id),
          platforms: accounts.map((a) => a.platform),
          status: mode === "draft" ? "draft" : "publishing",
          scheduled_at: mode === "schedule" ? scheduledAt!.toISOString() : null,
          timezone,
        })
        .select("*")
        .single();
      if (insertError || !local) return json({ error: "Could not save your post." }, 500);

      if (mode === "draft" && !accounts.length) {
        return json({ ok: true, post: local });
      }

      const targets = accounts.map((a) => ({
        platform: toZernioPlatform(a.platform),
        accountId: a.zernio_account_id,
      }));

      const result = await zernio.createPost({
        ...(title ? { title } : {}),
        content,
        ...(media.length ? { mediaItems: media } : {}),
        platforms: targets,
        ...(mode === "publish" ? { publishNow: true } : {}),
        ...(mode === "schedule" ? { scheduledFor: scheduledAt!.toISOString() } : {}),
        ...(mode === "draft" ? { isDraft: true } : {}),
        timezone,
        metadata: { tapthatflyer_post_id: local.id, tapthatflyer_user_id: user.id },
      }, `ttf-post-${local.id}`);

      if (result.ok === false) {
        const { data: failed } = await supabase
          .from("zernio_posts")
          .update({ status: mode === "draft" ? "draft" : "failed", last_error: result.message })
          .eq("id", local.id)
          .select("*")
          .maybeSingle();
        await logZernioEvent(supabase, {
          user_id: user.id,
          operation: `post_${mode}`,
          zernio_profile_id: profile?.zernio_profile_id ?? null,
          success: false,
          http_status: result.status,
          error_category: result.category,
          detail: result.message,
        });
        return json({ error: result.message, code: result.category, post: failed }, 400);
      }

      const remote = unwrapOne<ZernioPost>(result.data, "post");
      const status = mapStatus(remote.status, mode === "draft" ? "draft" : "publishing");
      const { data: saved } = await supabase
        .from("zernio_posts")
        .update({
          zernio_post_id: remoteId(remote) || null,
          status,
          published_at: (remote.publishedAt as string) ?? null,
          last_error: platformErrors(remote),
          response: remote as Record<string, unknown>,
        })
        .eq("id", local.id)
        .select("*")
        .maybeSingle();

      await logZernioEvent(supabase, {
        user_id: user.id,
        operation: `post_${mode}`,
        zernio_profile_id: profile?.zernio_profile_id ?? null,
        success: true,
        http_status: result.status,
        detail: `${targets.length} target(s), status ${status}`,
      });
      await supabase.from("usage_events").insert({
        user_id: user.id,
        event_type: `post_${mode}`,
        quantity: targets.length,
        metadata: { post_id: local.id, platforms: accounts.map((a) => a.platform) },
      });

      const warnings = (result.data as { warnings?: string[] })?.warnings ?? [];
      return json({ ok: true, post: saved ?? local, warnings });
    }

    // ------------------------------------------------- provider post feed ---
    if (action === "remote_history") {
      const { data: profile } = await supabase
        .from("zernio_profiles")
        .select("zernio_profile_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) return json({ posts: [] });
      const result = await zernio.listPosts(profile.zernio_profile_id);
      if (result.ok === false) return json({ error: result.message, code: result.category }, 400);
      const posts = unwrapList<ZernioPost>(result.data, "posts").map((p) => ({
        id: remoteId(p),
        status: p.status ?? null,
        content: (p.content as string) ?? "",
        published_at: (p.publishedAt as string) ?? null,
        scheduled_for: (p.scheduledFor as string) ?? null,
      }));
      return json({ posts });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_err) {
    console.error(JSON.stringify({ scope: "zernio", operation: action, success: false }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
