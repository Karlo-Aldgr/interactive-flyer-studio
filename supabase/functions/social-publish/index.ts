// Publish now, or enqueue a scheduled post. Also cancels / retries.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient } from "../_shared/social/store.ts";
import { publishVariant, rollupPostStatus, type VariantRow } from "../_shared/social/publish.ts";
import { CAPABILITIES } from "../_shared/social/capabilities.ts";

async function loadOwnedPost(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  postId: string,
  userId: string,
) {
  const { data: post } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!post) return null;
  const { data: variants } = await supabase
    .from("social_post_variants")
    .select("*")
    .eq("post_id", postId);
  return { post, variants: (variants ?? []) as VariantRow[] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "publish_now");
  const postId = String(body.post_id || "");
  if (!postId) return json({ error: "post_id is required" }, 400);

  const supabase = serviceClient();
  const loaded = await loadOwnedPost(supabase, postId, user.id);
  if (!loaded) return json({ error: "Post not found" }, 404);
  const { post, variants } = loaded;
  if (!variants.length) return json({ error: "Select at least one account before publishing." }, 400);

  // ---- cancel a scheduled post ------------------------------------------
  if (action === "cancel") {
    await supabase
      .from("social_publish_jobs")
      .update({ status: "cancelled" })
      .eq("post_id", postId)
      .in("status", ["pending", "locked"]);
    await supabase
      .from("social_post_variants")
      .update({ status: "cancelled" })
      .eq("post_id", postId)
      .in("status", ["queued", "draft"]);
    await supabase.from("social_posts").update({ status: "cancelled" }).eq("id", postId);
    return json({ ok: true, status: "cancelled" });
  }

  // ---- schedule ----------------------------------------------------------
  if (action === "schedule") {
    const scheduledAt = String(body.scheduled_at || post.scheduled_at || "");
    const when = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(when.getTime())) {
      return json({ error: "A valid scheduled date and time is required." }, 400);
    }
    if (when.getTime() < Date.now() + 60_000) {
      return json({ error: "Pick a time at least a minute in the future." }, 400);
    }
    const timezone = String(body.timezone || post.schedule_timezone || "UTC");

    await supabase.from("social_posts").update({
      status: "queued",
      scheduled_at: when.toISOString(),
      schedule_timezone: timezone,
      last_error: null,
    }).eq("id", postId);

    const rows = variants.map((v) => ({
      user_id: user.id,
      post_id: postId,
      variant_id: v.id,
      social_account_id: v.social_account_id,
      platform: v.platform,
      due_at: when.toISOString(),
      status: "pending",
      idempotency_key: `${postId}:${v.id}:${when.toISOString()}`,
    }));
    // Replace any previous queue for this post so rescheduling is safe.
    await supabase.from("social_publish_jobs").delete().eq("post_id", postId).in("status", [
      "pending",
      "locked",
      "failed",
      "cancelled",
    ]);
    const { error } = await supabase.from("social_publish_jobs").insert(rows);
    if (error) return json({ error: error.message }, 500);
    await supabase
      .from("social_post_variants")
      .update({ status: "queued", last_error: null })
      .eq("post_id", postId);

    return json({
      ok: true,
      status: "queued",
      scheduled_at: when.toISOString(),
      jobs: rows.length,
      scheduler_configured: Boolean(Deno.env.get("SOCIAL_CRON_SECRET")?.trim()),
    });
  }

  // ---- publish now (optionally only selected variants) -------------------
  const onlyIds: string[] = Array.isArray(body.variant_ids) ? body.variant_ids.map(String) : [];
  const targets = onlyIds.length ? variants.filter((v) => onlyIds.includes(v.id)) : variants;
  if (!targets.length) return json({ error: "No matching variants to publish." }, 400);

  await supabase.from("social_posts").update({ status: "publishing", last_error: null }).eq("id", postId);

  const results = [];
  for (const variant of targets) {
    const key = `${postId}:${variant.id}:now:${body.idempotency_key ?? ""}`;
    results.push(
      await publishVariant(supabase, variant, {
        idempotencyKey: key,
        scheduledAt: null,
        allowNativeSchedule: false,
      }),
    );
  }
  await rollupPostStatus(supabase, postId);

  const { data: finalPost } = await supabase
    .from("social_posts")
    .select("status")
    .eq("id", postId)
    .maybeSingle();

  return json({
    ok: results.some((r) => r.ok),
    status: finalPost?.status ?? "failed",
    results,
    capabilities: Object.fromEntries(targets.map((v) => [v.platform, CAPABILITIES[v.platform]])),
  });
});
