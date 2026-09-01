// Reads the customer's EXISTING projects/flyers so the social composer can
// reuse them as post media. No new tables, no re-upload, no duplicated files:
// the flyer's own thumbnail (public `flyer-thumbnails` bucket) and any video
// layer already stored on the flyer are referenced directly.
import { supabase } from "@/integrations/supabase/client";
import type { SocialMediaItem } from "./types";

export type FlyerLibraryItem = {
  flyer_id: string;
  job_id: string | null;
  title: string;
  project_title: string | null;
  thumbnail_url: string | null;
  public_slug: string | null;
  category: string | null;
  status: string | null;
  share_unlocked: boolean;
  updated_at: string;
};

/** Every flyer the signed-in user owns, newest first, with its project name. */
export async function fetchFlyerLibrary(): Promise<FlyerLibraryItem[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  // Jobs can belong to the user directly (user_id) OR be admin-created jobs
  // attached to a flyer the user owns. Both must be postable.
  const [{ data: flyers, error }, { data: ownJobs }, { data: flyerJobs }] = await Promise.all([
    supabase
      .from("flyers")
      .select("id, title, thumbnail_url, public_slug, category, status, updated_at")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("jobs")
      .select("id, title, flyer_id, share_unlocked, status, created_at")
      .eq("user_id", userId)
      .not("flyer_id", "is", null)
      .limit(300),
    supabase
      .from("jobs")
      .select("id, title, flyer_id, share_unlocked, status, created_at, flyer:flyers!inner(owner_id)")
      .eq("flyer.owner_id", userId)
      .not("flyer_id", "is", null)
      .limit(300),
  ]);
  if (error) throw error;

  const jobByFlyer = new Map<string, any>();
  for (const j of [...(ownJobs ?? []), ...(flyerJobs ?? [])]) {
    if (!j.flyer_id) continue;
    const prev = jobByFlyer.get(j.flyer_id as string);
    const rank = (x: any) => (x.share_unlocked ? 2 : 0) +
      (["paid", "completed", "delivered"].includes(x.status) ? 1 : 0);
    if (!prev || rank(j) > rank(prev)) jobByFlyer.set(j.flyer_id as string, j);
  }

  return (flyers ?? []).map((f) => {
    const job = jobByFlyer.get(f.id);
    return {
      flyer_id: f.id,
      job_id: job?.id ?? null,
      title: f.title || job?.title || "Untitled flyer",
      project_title: job?.title ?? null,
      thumbnail_url: f.thumbnail_url,
      public_slug: f.public_slug,
      category: f.category ?? null,
      status: f.status ?? null,
      share_unlocked: !!job?.share_unlocked,
      updated_at: f.updated_at,
    };
  });
}

/** The flyer's current image asset as composer media (never copied/re-uploaded). */
export function flyerImageMedia(item: FlyerLibraryItem): SocialMediaItem | null {
  if (!item.thumbnail_url?.startsWith("http")) return null;
  return {
    type: "image",
    url: item.thumbnail_url,
    mime_type: "image/jpeg",
    file_name: `${item.title}.jpg`,
  };
}

/**
 * Videos already living on the flyer (video layers). Used when a platform such
 * as TikTok cannot publish a still image — we only ever offer the project's own
 * assets, never a substitute.
 */
export async function fetchFlyerVideos(flyerId: string): Promise<SocialMediaItem[]> {
  const { data: pages } = await supabase.from("pages").select("id").eq("flyer_id", flyerId);
  const pageIds = (pages ?? []).map((p) => p.id);
  if (!pageIds.length) return [];

  const { data: layers } = await supabase
    .from("layers")
    .select("id, content")
    .eq("type", "video")
    .in("page_id", pageIds)
    .limit(20);

  const out: SocialMediaItem[] = [];
  for (const layer of layers ?? []) {
    const content = (layer.content ?? {}) as Record<string, unknown>;
    const src = [content.src, content.url, content.videoUrl].find(
      (v) => typeof v === "string" && v.startsWith("http"),
    ) as string | undefined;
    if (src) out.push({ type: "video", url: src, file_name: "flyer-video.mp4" });
  }
  return out;
}
