// Bulk "Post to Socials": fans a set of owned projects out to a set of owned
// social accounts. One social_posts row per project, one variant per account,
// each published independently so a single failure never blocks the rest.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient } from "../_shared/social/store.ts";
import { publishVariant, rollupPostStatus, type VariantRow } from "../_shared/social/publish.ts";
import { isSocialPlatform } from "../_shared/social/types.ts";

function appBaseUrl() {
  return (Deno.env.get("SOCIAL_APP_BASE_URL")?.trim() || "https://tapthatflyer.com").replace(/\/$/, "");
}

/** Platform-specific caption from the existing AI marketing draft, if any. */
function captionForPlatform(
  draft: Record<string, unknown> | null,
  platform: string,
  fallback: string,
) {
  if (!draft) return fallback;
  const key = platform === "instagram"
    ? "instagram_caption"
    : platform === "tiktok"
    ? "tiktok_caption"
    : "facebook_post";
  const value = draft[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({}));
  const jobIds: string[] = Array.isArray(body.job_ids) ? body.job_ids.map(String) : [];
  const accountIds: string[] = Array.isArray(body.account_ids) ? body.account_ids.map(String) : [];
  if (!jobIds.length) return json({ error: "Select at least one project." }, 400);
  if (!accountIds.length) return json({ error: "Select at least one connected account." }, 400);

  const supabase = serviceClient();

  // Ownership is verified server-side; the ids from the browser are untrusted.
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, brief, flyer_id, share_unlocked, flyer:flyers(id, title, public_slug, thumbnail_url)")
    .in("id", jobIds)
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (jobsError) return json({ error: jobsError.message }, 500);
  if (!jobs?.length) return json({ error: "None of those projects belong to you." }, 403);

  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("id, platform, account_name, connection_status")
    .in("id", accountIds)
    .eq("user_id", user.id);
  if (accountsError) return json({ error: accountsError.message }, 500);
  if (!accounts?.length) return json({ error: "None of those accounts belong to you." }, 403);

  const usable = accounts.filter((a) => isSocialPlatform(a.platform));
  const results: unknown[] = [];

  for (const job of jobs) {
    // deno-lint-ignore no-explicit-any
    const flyer = (job as any).flyer as
      | { id: string; title: string; public_slug: string | null; thumbnail_url: string | null }
      | null;

    const { data: draft } = flyer?.id
      ? await supabase
        .from("marketing_drafts")
        .select("facebook_post, instagram_caption, tiktok_caption")
        .eq("flyer_id", flyer.id)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      : { data: null };

    const baseCaption = [job.title, job.brief].filter(Boolean).join("\n\n").trim() ||
      flyer?.title || "New from TapThatFlyer";
    const link = flyer?.public_slug && job.share_unlocked
      ? `${appBaseUrl()}/f/${flyer.public_slug}`
      : null;
    const media = flyer?.thumbnail_url?.startsWith("http")
      ? [{ type: "image" as const, url: flyer.thumbnail_url }]
      : [];

    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .insert({
        user_id: user.id,
        flyer_id: flyer?.id ?? null,
        title: job.title,
        content: baseCaption,
        link_url: link,
        hashtags: [],
        media,
        status: "publishing",
      })
      .select("id")
      .single();
    if (postError || !post) {
      results.push({ job_id: job.id, ok: false, message: postError?.message ?? "Could not create the post." });
      continue;
    }

    const variantRows = usable.map((account) => ({
      post_id: post.id,
      user_id: user.id,
      social_account_id: account.id,
      platform: account.platform,
      caption: captionForPlatform(draft as Record<string, unknown> | null, account.platform, baseCaption),
      hashtags: [] as string[],
      media,
      link_url: link,
    }));

    const { data: variants, error: variantError } = await supabase
      .from("social_post_variants")
      .insert(variantRows)
      .select("*");
    if (variantError || !variants) {
      results.push({ job_id: job.id, ok: false, message: variantError?.message ?? "Could not queue platforms." });
      continue;
    }

    for (const variant of variants as VariantRow[]) {
      const outcome = await publishVariant(supabase, variant, {
        idempotencyKey: `bulk:${post.id}:${variant.id}`,
        scheduledAt: null,
        allowNativeSchedule: false,
      });
      results.push({
        job_id: job.id,
        job_title: job.title,
        post_id: post.id,
        ...outcome,
      });
    }
    await rollupPostStatus(supabase, post.id);
  }

  const published = results.filter((r) => {
    const v = r as { ok?: boolean; pending?: boolean };
    return v.ok && !v.pending;
  }).length;
  const pending = results.filter((r) => (r as { pending?: boolean }).pending).length;
  return json({
    ok: published > 0,
    projects: jobs.length,
    accounts: usable.length,
    published,
    pending,
    failed: results.length - published - pending,
    results,
  });
});
