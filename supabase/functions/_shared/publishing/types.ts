/** Platform-agnostic publishing contracts shared by every caller and adapter. */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export const PLATFORMS = ["facebook", "instagram", "tiktok"] as const;
export type Platform = typeof PLATFORMS[number];

export type MediaType = "image" | "video";

export type MediaItem = {
  type: MediaType;
  url: string;
};

export type PublishRequest = {
  ownerId: string;
  platforms: Platform[];
  caption: string;
  /** Zero or more media items. Adapters currently publish the first item. */
  media: MediaItem[];
  link?: string;
  /** Optional marketing_drafts row this publish belongs to (status patches applied). */
  draftId?: string;
};

export type PlatformStatus = "success" | "failed" | "not_connected";

export type PlatformResult = {
  platform: Platform;
  status: PlatformStatus;
  post_id?: string;
  error?: string;
  token_source?: string;
  attempt_at: string;
};

export type PublishOutcome = {
  status: "success" | "partial_success" | "failed";
  results: PlatformResult[];
};

export type AdapterContext = {
  /** Service-role client. Adapters never receive user JWT clients. */
  supabase: SupabaseClient;
  ownerId: string;
  caption: string;
  media: MediaItem[];
  link?: string;
  graphVersion: string;
};

export type PlatformAdapter = (ctx: AdapterContext) => Promise<PlatformResult>;

export function primaryMedia(media: MediaItem[]): MediaItem | null {
  return media.length > 0 ? media[0] : null;
}
