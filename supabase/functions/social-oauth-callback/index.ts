// Platform redirect target. Validates the single-use state, exchanges the code
// server-side, stores encrypted tokens, then bounces the user back into the app.
//
// Two entry styles are supported:
//  - GET  : the provider redirects the browser here; we 302 back into the app.
//  - POST : an app-domain callback page (e.g. Instagram Business Login at
//           /auth/instagram/callback) forwards {code, state} and gets JSON back.
import { corsHeaders } from "../_shared/social/cors.ts";
import { saveAccounts, serviceClient } from "../_shared/social/store.ts";
import { getAdapter } from "../_shared/social/registry.ts";
import { sha256Hex } from "../_shared/social/crypto.ts";
import { isSocialPlatform } from "../_shared/social/types.ts";
import { callbackUrlFor } from "../_shared/social/redirect.ts";

function appBaseUrl() {
  return (Deno.env.get("SOCIAL_APP_BASE_URL")?.trim() || "https://tapthatflyer.com").replace(/\/$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const isPost = req.method === "POST";
  const url = new URL(req.url);
  let state = url.searchParams.get("state") ?? "";
  let code = url.searchParams.get("code") ?? "";
  let providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (isPost) {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    state = typeof body.state === "string" ? body.state : "";
    code = typeof body.code === "string" ? body.code : "";
    providerError = typeof body.error_description === "string"
      ? body.error_description
      : (typeof body.error === "string" ? body.error : null);
  }

  const fail = (message: string, redirectPath = "/dashboard/social", platform?: string) => {
    if (isPost) {
      return new Response(JSON.stringify({ ok: false, error: message, redirect_path: redirectPath }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const target = new URL(appBaseUrl() + redirectPath);
    target.searchParams.set("social_error", message);
    if (platform) target.searchParams.set("social_platform", platform);
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target.toString() } });
  };

  const done = (platform: string, count: number, redirectPath: string) => {
    if (isPost) {
      return new Response(
        JSON.stringify({ ok: true, platform, accounts: count, redirect_path: redirectPath }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const target = new URL(appBaseUrl() + redirectPath);
    target.searchParams.set("social_connected", platform);
    target.searchParams.set("social_accounts", String(count));
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target.toString() } });
  };

  if (!state) return fail("Missing authorization state.");

  const supabase = serviceClient();
  const stateHash = await sha256Hex(state);
  const { data: row } = await supabase
    .from("social_oauth_states")
    .select("*")
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (!row) return fail("This connection link is invalid or already used.");

  // Single use, regardless of the outcome.
  await supabase.from("social_oauth_states").delete().eq("id", row.id);

  const redirectPath = typeof row.redirect_path === "string" && row.redirect_path.startsWith("/")
    ? row.redirect_path
    : "/dashboard/social";

  if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return fail("This connection link expired. Try connecting again.", redirectPath);
  }
  if (providerError) return fail(String(providerError).slice(0, 200), redirectPath, row.platform);
  if (!code || !isSocialPlatform(row.platform)) {
    return fail("The platform did not return an authorization code.", redirectPath);
  }

  const adapter = getAdapter(row.platform);
  try {
    const result = await adapter.handleCallback({
      code,
      redirectUri: callbackUrlFor(row.platform),
      codeVerifier: row.code_verifier,
    });
    if (result.ok === false) return fail(result.message, redirectPath, row.platform);
    await saveAccounts(supabase, row.user_id, row.platform, result.accounts);
    return done(row.platform, result.accounts.length, redirectPath);
  } catch (err) {
    console.error("[social-oauth-callback]", err);
    return fail("Could not finish the connection. Please try again.", redirectPath, row.platform);
  }
});
