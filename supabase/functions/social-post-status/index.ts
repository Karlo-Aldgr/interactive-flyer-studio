// Refreshes the remote status of published variants (delete + status checks).
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { ensureFreshToken, loadAccount, requireUser, serviceClient } from "../_shared/social/store.ts";
import { getAdapter } from "../_shared/social/registry.ts";
import { rollupPostStatus } from "../_shared/social/publish.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "refresh");
  const variantId = String(body.variant_id || "");
  if (!variantId) return json({ error: "variant_id is required" }, 400);

  const supabase = serviceClient();
  const { data: variant } = await supabase
    .from("social_post_variants")
    .select("*")
    .eq("id", variantId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!variant) return json({ error: "Post variant not found" }, 404);
  if (!variant.social_account_id || !variant.remote_post_id) {
    return json({ error: "This variant has not been published yet." }, 400);
  }

  const loaded = await loadAccount(supabase, variant.social_account_id);
  if ("ok" in loaded && loaded.ok === false) {
    return json({ error: loaded.message, code: loaded.code }, 400);
  }
  const fresh = await ensureFreshToken(supabase, loaded as never);
  if ("ok" in fresh && (fresh as { ok: false }).ok === false) {
    const err = fresh as { message: string; code: string };
    return json({ error: err.message, code: err.code }, 400);
  }
  // deno-lint-ignore no-explicit-any
  const account = fresh as any;
  const adapter = getAdapter(account.platform);

  if (action === "delete") {
    const result = await adapter.deletePost(account, variant.remote_post_id);
    if (result.ok === false) return json({ error: result.message, code: result.code }, 400);
    await supabase.from("social_post_variants").update({
      // there is no "deleted" variant status; cancelled marks it removed remotely
      status: "cancelled",
      remote_post_url: null,
      last_error: null,
    }).eq("id", variantId);
    await rollupPostStatus(supabase, variant.post_id);
    return json({ ok: true, deleted: true });
  }

  const result = await adapter.getPostStatus(account, variant.remote_post_id);
  if (result.ok === false) return json({ error: result.message, code: result.code }, 400);
  await supabase.from("social_post_variants").update({
    remote_post_url: result.remote_post_url ?? variant.remote_post_url,
    status: result.status === "deleted" ? "cancelled" : variant.status,
  }).eq("id", variantId);
  return json({ ok: true, remote_status: result.status, remote_post_url: result.remote_post_url });
});
