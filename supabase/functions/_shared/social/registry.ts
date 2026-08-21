import type { SocialPlatform, SocialPlatformAdapter } from "./types.ts";
import { facebookAdapter } from "./adapters/facebook.ts";
import { instagramAdapter } from "./adapters/instagram.ts";
import { tiktokAdapter } from "./adapters/tiktok.ts";
import { linkedinAdapter } from "./adapters/linkedin.ts";
import { xAdapter } from "./adapters/x.ts";
import { youtubeAdapter } from "./adapters/youtube.ts";

const REGISTRY: Record<SocialPlatform, SocialPlatformAdapter> = {
  facebook: facebookAdapter,
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  linkedin: linkedinAdapter,
  x: xAdapter,
  youtube: youtubeAdapter,
};

export function getAdapter(platform: SocialPlatform): SocialPlatformAdapter {
  return REGISTRY[platform];
}

export function allAdapters(): SocialPlatformAdapter[] {
  return Object.values(REGISTRY);
}

/** Platforms that require PKCE during authorization. */
export const PKCE_PLATFORMS: SocialPlatform[] = ["x"];

/** Configuration status for the Settings / Integrations screen (names only). */
export function integrationStatus(platform: SocialPlatform) {
  const adapter = getAdapter(platform);
  const missing = adapter.requiredSecrets.filter((name) => !Deno.env.get(name)?.trim());
  return {
    platform,
    required_secrets: adapter.requiredSecrets,
    missing_secrets: missing,
    configured: missing.length === 0,
    scopes: adapter.defaultScopes,
    approval_notes: adapter.approvalNotes,
    developer_console_url: adapter.developerConsoleUrl,
  };
}
