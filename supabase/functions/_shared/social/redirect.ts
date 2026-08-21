// Single source of truth for the OAuth redirect URI used by the TapThatFlyer
// social stack. Meta (Facebook/Instagram) can override it independently so the
// dedicated TapThatFlyer Social Meta app can register its own callback.
import type { SocialPlatform } from "./types.ts";

export function defaultCallbackUrl() {
  const explicit = Deno.env.get("SOCIAL_OAUTH_CALLBACK_URL")?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/social-oauth-callback`;
}

export function callbackUrlFor(platform: SocialPlatform) {
  if (platform === "facebook" || platform === "instagram") {
    const meta = Deno.env.get("SOCIAL_META_OAUTH_REDIRECT_URI")?.trim();
    if (meta) return meta.replace(/\/$/, "");
  }
  return defaultCallbackUrl();
}
