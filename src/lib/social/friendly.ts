import type { ConnectionStatus, SocialPlatform } from "./types";
import { PLATFORM_LABEL } from "./types";

/**
 * Customer-facing language. Raw API errors, secret names, scopes, tokens and
 * backend terminology never reach the client UI — only these messages do.
 */

export type FriendlyState = "connected" | "attention" | "failed" | "idle";

export function friendlyState(status: ConnectionStatus): FriendlyState {
  if (status === "connected") return "connected";
  if (status === "error") return "failed";
  return "attention";
}

export function friendlyStatusLabel(status: ConnectionStatus): string {
  switch (friendlyState(status)) {
    case "connected":
      return "Connected";
    case "failed":
      return "Connection failed";
    default:
      return "Needs attention";
  }
}

export function friendlyStatusDetail(
  status: ConnectionStatus,
  platform: SocialPlatform,
): string | null {
  const label = PLATFORM_LABEL[platform];
  switch (friendlyState(status)) {
    case "connected":
      return null;
    case "failed":
      return `We couldn't connect your ${label} account. Please try again.`;
    default:
      return `Your ${label} connection needs to be renewed.`;
  }
}

/** Turn any thrown error into something a business owner can act on. */
export function friendlyErrorMessage(err: unknown, platform?: SocialPlatform): string {
  const label = platform ? PLATFORM_LABEL[platform] : "your account";
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/network|fetch|timeout/i.test(raw)) {
    return `We couldn't reach ${label} just now. Please check your connection and try again.`;
  }
  if (/sign in|unauthor|401/i.test(raw)) {
    return "Please sign in again to continue.";
  }
  return `We couldn't connect ${label}. Please try again.`;
}

/** Short, non-technical description of what connecting a platform does. */
export const PLATFORM_BLURB: Record<SocialPlatform, string> = {
  facebook: "Publish your flyers to a Facebook Page you manage.",
  instagram: "Share your flyers to your Instagram business account.",
  tiktok: "Post your flyer videos and images to TikTok.",
  linkedin: "Share your flyers with your LinkedIn audience.",
  x: "Post your flyers to X.",
  youtube: "Upload your flyer videos to your YouTube channel.",
};
