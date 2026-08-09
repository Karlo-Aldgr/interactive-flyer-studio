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
  /** Authenticated user performing the publish (admin/editor acting for owner). */
  actorId?: string;
  platforms: Platform[];

  caption: string;
  /** Zero or more media items. Adapters currently publish the first item. */
  media: MediaItem[];
  link?: string;
  /** Optional marketing_drafts row this publish belongs to (status patches applied). */
  draftId?: string;
  /** Correlates a publish with the API request / job that produced it. */
  requestId?: string;
  /**
   * Stable caller-supplied key. Reserved for the queued executor so a retried
   * enqueue resolves to the same job instead of double-posting.
   */
  idempotencyKey?: string;
  /** ISO timestamp. Absent or in the past means "publish as soon as possible". */
  scheduledAt?: string;
};

/**
 * `queued` is only ever returned by an asynchronous executor: the request was
 * accepted and the terminal result must be read back via the job id.
 */
export type PlatformStatus = "success" | "failed" | "not_connected" | "queued";

export type PlatformResult = {
  platform: Platform;
  status: PlatformStatus;
  post_id?: string;
  error?: string;
  token_source?: string;
  attempt_at: string;
};

export type PublishOutcomeStatus = "success" | "partial_success" | "failed" | "queued";

export type PublishOutcome = {
  status: PublishOutcomeStatus;
  results: PlatformResult[];
  /** Present only when an asynchronous executor accepted the work. */
  job_id?: string;
};

export type AdapterContext = {
  /** Service-role client. Adapters never receive user JWT clients. */
  supabase: SupabaseClient;
  ownerId: string;
  /** Falls back to this user's Meta/TikTok connection when the owner has none. */
  actorId?: string;
  caption: string;

  media: MediaItem[];
  link?: string;
  graphVersion: string;
};

export type PlatformAdapter = (ctx: AdapterContext) => Promise<PlatformResult>;

/**
 * Strategy that decides *when* a validated PublishRequest runs. The public
 * contract (`PublishRequest` in, `PublishOutcome` out) is identical for every
 * executor, so swapping inline execution for a queue never changes callers.
 */
export type PublishExecutor = {
  name: "inline" | "queued";
  run(supabase: SupabaseClient, request: PublishRequest): Promise<PublishOutcome>;
};

export function summarizeResults(results: PlatformResult[]): PublishOutcomeStatus {
  if (results.length > 0 && results.every((r) => r.status === "queued")) return "queued";
  const successes = results.filter((r) => r.status === "success").length;
  if (successes > 0 && successes === results.length) return "success";
  if (successes > 0) return "partial_success";
  return "failed";
}


export function primaryMedia(media: MediaItem[]): MediaItem | null {
  return media.length > 0 ? media[0] : null;
}
