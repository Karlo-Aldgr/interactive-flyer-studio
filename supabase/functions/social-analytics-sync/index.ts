// Pulls fresh metrics for published variants and stores normalized snapshots.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { ensureFreshToken, loadAccount, requireUser, serviceClient } from "../_shared/social/store.ts";
import { getAdapter } from "../_shared/social/registry.ts";

const MAX_VARIANTS = 40;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("SOCIAL_CRON_SECRET")?.trim();
  const isCron = Boolean(cronSecret) && req.headers.get("x-cron-secret") === cronSecret;

  let userId: string | null = null;
  if (!isCron) {
    const user = await requireUser(req);
    if (!user) return json({ error: "Sign in required" }, 401);
    userId = user.id;
  }

  const body = await req.json().catch(() => ({}));
  const supabase = serviceClient();

  let query = supabase
    .from("social_post_variants")
    .select("id, user_id, post_id, platform, social_account_id, remote_post_id")
    .eq("status", "published")
    .not("remote_post_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(MAX_VARIANTS);
  if (userId) query = query.eq("user_id", userId);
  if (typeof body.variant_id === "string") query = query.eq("id", body.variant_id);
  if (typeof body.post_id === "string") query = query.eq("post_id", body.post_id);

  const { data: variants } = await query;
  const synced: unknown[] = [];

  for (const variant of variants ?? []) {
    if (!variant.social_account_id) continue;
    const loaded = await loadAccount(supabase, variant.social_account_id);
    if ("ok" in loaded && loaded.ok === false) {
      synced.push({ variant_id: variant.id, ok: false, message: loaded.message });
      continue;
    }
    const fresh = await ensureFreshToken(supabase, loaded as never);
    if ("ok" in fresh && (fresh as { ok: false }).ok === false) {
      synced.push({ variant_id: variant.id, ok: false, message: (fresh as { message: string }).message });
      continue;
    }
    // deno-lint-ignore no-explicit-any
    const account = fresh as any;
    const result = await getAdapter(variant.platform).getAnalytics(account, variant.remote_post_id!);
    if (result.ok === false) {
      synced.push({ variant_id: variant.id, ok: false, message: result.message, code: result.code });
      continue;
    }
    const m = result;
    const { error } = await supabase.from("social_post_analytics").insert({
      user_id: variant.user_id,
      post_id: variant.post_id,
      variant_id: variant.id,
      social_account_id: variant.social_account_id,
      platform: variant.platform,
      captured_at: new Date().toISOString(),
      impressions: m.impressions ?? null,
      reach: m.reach ?? null,
      engagements: m.engagements ?? null,
      likes: m.likes ?? null,
      comments: m.comments ?? null,
      shares: m.shares ?? null,
      clicks: m.clicks ?? null,
      video_views: m.video_views ?? null,
      platform_metrics: m.platform_metrics ?? {},
    });
    synced.push({ variant_id: variant.id, ok: !error, message: error?.message });
  }

  return json({ ok: true, checked: variants?.length ?? 0, synced });
});
