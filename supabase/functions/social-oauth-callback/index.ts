// Platform redirect target. Validates the single-use state, exchanges the code
// server-side, stores encrypted tokens, then bounces the user back into the app.
import { corsHeaders } from "../_shared/social/cors.ts";
import { saveAccounts, serviceClient } from "../_shared/social/store.ts";
import { getAdapter } from "../_shared/social/registry.ts";
import { sha256Hex } from "../_shared/social/crypto.ts";
import { isSocialPlatform } from "../_shared/social/types.ts";

function appBaseUrl() {
  return (Deno.env.get("SOCIAL_APP_BASE_URL")?.trim() || "https://tapthatflyer.com").replace(/\/$/, "");
}

function callbackUrl() {
  const explicit = Deno.env.get("SOCIAL_OAUTH_CALLBACK_URL")?.trim();
  if (explicit) return explicit;
  return `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/social-oauth-callback`;
}

function bounce(path: string, params: Record<string, string>) {
  const url = new URL(appBaseUrl() + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: url.toString() } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (!state) {
    return bounce("/dashboard/social", { social_error: "Missing authorization state." });
  }

  const supabase = serviceClient();
  const stateHash = await sha256Hex(state);
  const { data: row } = await supabase
    .from("social_oauth_states")
    .select("*")
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (!row) {
    return bounce("/dashboard/social", { social_error: "This connection link is invalid or already used." });
  }
  // Single use, regardless of the outcome.
  await supabase.from("social_oauth_states").delete().eq("id", row.id);

  const redirectPath = typeof row.redirect_path === "string" && row.redirect_path.startsWith("/")
    ? row.redirect_path
    : "/dashboard/social";

  if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return bounce(redirectPath, { social_error: "This connection link expired. Try connecting again." });
  }
  if (providerError) {
    return bounce(redirectPath, { social_error: providerError.slice(0, 200) });
  }
  if (!code || !isSocialPlatform(row.platform)) {
    return bounce(redirectPath, { social_error: "The platform did not return an authorization code." });
  }

  const adapter = getAdapter(row.platform);
  try {
    const result = await adapter.handleCallback({
      code,
      redirectUri: callbackUrl(),
      codeVerifier: row.code_verifier,
    });
    if (result.ok === false) {
      return bounce(redirectPath, { social_error: result.message, social_platform: row.platform });
    }
    await saveAccounts(supabase, row.user_id, row.platform, result.accounts);
    return bounce(redirectPath, {
      social_connected: row.platform,
      social_accounts: String(result.accounts.length),
    });
  } catch (err) {
    console.error("[social-oauth-callback]", err);
    return bounce(redirectPath, {
      social_error: "Could not finish the connection. Please try again.",
      social_platform: row.platform,
    });
  }
});
