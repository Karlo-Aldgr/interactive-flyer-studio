import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import type { MediaItem, Platform, PlatformResult, PublishRequest } from "./types.ts";

const DRAFT_CAPTION_FIELD: Record<Platform, string> = {
  facebook: "facebook_post",
  instagram: "instagram_caption",
  tiktok: "tiktok_caption",
};

export type DraftResolution =
  | { ok: false; reason: "not_found" | "forbidden"; message: string }
  | {
    ok: true;
    /** One request per platform — each is independently executable/queueable. */
    requests: PublishRequest[];
    /** Platforms rejected before any provider call (e.g. no copy yet). */
    skipped: PlatformResult[];
    media: MediaItem[];
  };

/**
 * Turns a marketing draft into plain PublishRequests. Kept separate from
 * execution so the API handler and a future queue worker resolve drafts the
 * same way — the worker can persist these requests and run them later.
 */
export async function resolveDraftRequests(
  supabase: SupabaseClient,
  args: { draftId: string; ownerId: string; platforms: Platform[]; requestId?: string },
): Promise<DraftResolution> {
  const { data: draft, error } = await supabase
    .from("marketing_drafts")
    .select("*")
    .eq("id", args.draftId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!draft) return { ok: false, reason: "not_found", message: "Draft not found" };
  if (String(draft.owner_id) !== args.ownerId) {
    return { ok: false, reason: "forbidden", message: "This draft belongs to another account" };
  }

  const mediaUrl = typeof draft.thumbnail_url === "string" ? draft.thumbnail_url.trim() : "";
  const media: MediaItem[] = mediaUrl.startsWith("https://")
    ? [{ type: "image", url: mediaUrl }]
    : [];
  const link = typeof draft.flyer_url === "string" ? draft.flyer_url : undefined;

  const requests: PublishRequest[] = [];
  const skipped: PlatformResult[] = [];

  for (const platform of args.platforms) {
    const caption = String(
      (draft as Record<string, unknown>)[DRAFT_CAPTION_FIELD[platform]] || draft.facebook_post || "",
    ).trim();
    if (!caption) {
      skipped.push({
        platform,
        status: "failed",
        error: `Draft has no ${platform} copy yet`,
        attempt_at: new Date().toISOString(),
      });
      continue;
    }
    requests.push({
      ownerId: args.ownerId,
      platforms: [platform],
      caption,
      media,
      link,
      draftId: String(draft.id),
      requestId: args.requestId,
    });
  }

  return { ok: true, requests, skipped, media };
}
