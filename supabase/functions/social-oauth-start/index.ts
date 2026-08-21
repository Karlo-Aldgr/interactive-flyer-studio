// Starts an OAuth authorization for one platform.
// Creates a CSRF-safe, single-use, expiring state bound to (user, platform, redirect).
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient, tokenEncryptionReady } from "../_shared/social/store.ts";
import { getAdapter, PKCE_PLATFORMS } from "../_shared/social/registry.ts";
import { pkceChallenge, randomToken, sha256Hex } from "../_shared/social/crypto.ts";
import { isSocialPlatform } from "../_shared/social/types.ts";

const STATE_TTL_MINUTES = 15;

/** Callback URL registered with every platform app. */
export function callbackUrl() {
  const explicit = Deno.env.get("SOCIAL_OAUTH_CALLBACK_URL")?.trim();
  if (explicit) return explicit;
  const ref = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  return `${ref}/functions/v1/social-oauth-callback`;
}

/** Only same-site relative paths may be used as the post-connect destination. */
function safeRedirectPath(value: unknown) {
  if (typeof value !== "string") return "/dashboard/social";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard/social";
  return value.slice(0, 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({}));
  const platform = body.platform;
  if (!isSocialPlatform(platform)) return json({ error: "Unknown platform" }, 400);
  if (!tokenEncryptionReady()) {
    return json({
      error:
        "SOCIAL_TOKEN_ENCRYPTION_KEY is not configured, so connections cannot be stored securely. Add it in Project Settings → Secrets.",
      code: "not_configured",
    }, 400);
  }

  const supabase = serviceClient();
  const adapter = getAdapter(platform);
  const state = randomToken(32);
  const stateHash = await sha256Hex(state);
  const needsPkce = PKCE_PLATFORMS.includes(platform);
  const codeVerifier = needsPkce ? randomToken(48) : null;

  const started = await adapter.startOAuth({
    redirectUri: callbackUrl(),
    state,
    scopes: Array.isArray(body.scopes) && body.scopes.length ? body.scopes : adapter.defaultScopes,
  });
  if (started.ok === false) {
    return json({ error: started.message, code: started.code }, 400);
  }

  const authorizeUrl = new URL(started.authorize_url);
  if (needsPkce && codeVerifier) {
    authorizeUrl.searchParams.set("code_challenge", await pkceChallenge(codeVerifier));
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
  }

  const { error } = await supabase.from("social_oauth_states").insert({
    state_hash: stateHash,
    user_id: user.id,
    platform,
    redirect_path: safeRedirectPath(body.redirect_path),
    code_verifier: codeVerifier,
    expires_at: new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) return json({ error: error.message }, 500);

  // Housekeeping: drop expired handshakes.
  await supabase.from("social_oauth_states").delete().lt("expires_at", new Date().toISOString());

  return json({ authorize_url: authorizeUrl.toString(), expires_in: STATE_TTL_MINUTES * 60 });
});
