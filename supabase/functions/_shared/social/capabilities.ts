// Capability matrix — the single source of truth for what each platform can do.
// A byte-identical copy lives at src/lib/social/capabilities.ts so the browser
// can disable unsupported options with the exact same rules the server enforces.
// Keep the two files in sync when editing.

import type { SocialPlatform } from "./types.ts";

export type PlatformCapabilities = {
  platform: SocialPlatform;
  label: string;
  text: boolean;
  links: boolean;
  singleImage: boolean;
  multiImage: boolean;
  video: boolean;
  nativeScheduling: boolean;
  delete: boolean;
  analytics: boolean;
  accountSelection: boolean;
  requiresMedia: boolean;
  maxCharacters: number | null;
  maxMedia: number;
  notes: string;
};

export const CAPABILITIES: Record<SocialPlatform, PlatformCapabilities> = {
  facebook: {
    platform: "facebook",
    label: "Facebook Page",
    text: true,
    links: true,
    singleImage: true,
    multiImage: true,
    video: true,
    nativeScheduling: true,
    delete: true,
    analytics: true,
    accountSelection: true,
    requiresMedia: false,
    maxCharacters: 63206,
    maxMedia: 10,
    notes: "Publishes to a Facebook Page you manage. Link posts render a preview card.",
  },
  instagram: {
    platform: "instagram",
    label: "Instagram Business",
    text: false,
    links: false,
    singleImage: true,
    multiImage: true,
    video: true,
    nativeScheduling: false,
    delete: false,
    analytics: true,
    accountSelection: true,
    requiresMedia: true,
    maxCharacters: 2200,
    maxMedia: 10,
    notes: "Requires an Instagram Business/Creator account linked to a Facebook Page. Captions cannot contain clickable links.",
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    text: false,
    links: false,
    singleImage: true,
    multiImage: true,
    video: true,
    nativeScheduling: false,
    delete: false,
    analytics: true,
    accountSelection: false,
    requiresMedia: true,
    maxCharacters: 2200,
    maxMedia: 35,
    notes: "Content Posting API. Unaudited apps can only publish to a private (SELF_ONLY) audience.",
  },
  linkedin: {
    platform: "linkedin",
    label: "LinkedIn",
    text: true,
    links: true,
    singleImage: true,
    multiImage: true,
    video: true,
    nativeScheduling: false,
    delete: true,
    analytics: false,
    accountSelection: true,
    requiresMedia: false,
    maxCharacters: 3000,
    maxMedia: 9,
    notes: "Posts as the authenticated member or an organization page you administer.",
  },
  x: {
    platform: "x",
    label: "X (Twitter)",
    text: true,
    links: true,
    singleImage: true,
    multiImage: true,
    video: true,
    nativeScheduling: false,
    delete: true,
    analytics: false,
    accountSelection: false,
    requiresMedia: false,
    maxCharacters: 280,
    maxMedia: 4,
    notes: "Media upload and post metrics require a paid X API tier.",
  },
  youtube: {
    platform: "youtube",
    label: "YouTube",
    text: false,
    links: true,
    singleImage: false,
    multiImage: false,
    video: true,
    nativeScheduling: true,
    delete: true,
    analytics: true,
    accountSelection: true,
    requiresMedia: true,
    maxCharacters: 5000,
    maxMedia: 1,
    notes: "Uploads a video to a channel you own. Unverified apps upload as private until Google review.",
  },
};

export type ValidationIssue = { field: string; message: string };

/** Server-side and client-side validation of a variant against the matrix. */
export function validateVariant(
  platform: SocialPlatform,
  input: {
    caption: string;
    hashtags?: string[];
    link?: string | null;
    media?: { type: "image" | "video" }[];
  },
): ValidationIssue[] {
  const cap = CAPABILITIES[platform];
  const issues: ValidationIssue[] = [];
  const media = input.media ?? [];
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  const tagLen = (input.hashtags ?? []).join(" #").length;
  const length = input.caption.length + (tagLen ? tagLen + 2 : 0);

  if (cap.maxCharacters !== null && length > cap.maxCharacters) {
    issues.push({
      field: "caption",
      message: `${cap.label} allows ${cap.maxCharacters} characters — currently ${length}.`,
    });
  }
  if (cap.requiresMedia && media.length === 0) {
    issues.push({ field: "media", message: `${cap.label} requires at least one image or video.` });
  }
  if (!cap.text && media.length === 0) {
    issues.push({ field: "media", message: `${cap.label} does not support text-only posts.` });
  }
  if (!cap.links && input.link) {
    issues.push({
      field: "link",
      message: `${cap.label} does not make links clickable — the URL will appear as plain text.`,
    });
  }
  if (!cap.video && videos.length > 0) {
    issues.push({ field: "media", message: `${cap.label} does not support video.` });
  }
  if (!cap.singleImage && images.length > 0) {
    issues.push({ field: "media", message: `${cap.label} does not support images.` });
  }
  if (!cap.multiImage && images.length > 1) {
    issues.push({ field: "media", message: `${cap.label} supports only one image per post.` });
  }
  if (media.length > cap.maxMedia) {
    issues.push({ field: "media", message: `${cap.label} allows at most ${cap.maxMedia} files.` });
  }
  return issues;
}
