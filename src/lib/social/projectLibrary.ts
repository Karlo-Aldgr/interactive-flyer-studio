// Source of truth for "which of my projects can I post to social?".
//
// Projects are `jobs` rows — NOT flyers. A job is postable whether it is a
// designed flyer (jobs.flyer_id -> flyers) or a plain upload (jobs.upload_url).
// Requiring a flyers row is what previously hid uploaded projects such as an
// upload-type job with flyer_id = NULL.
import { supabase } from "@/integrations/supabase/client";
import { getJobUploadSignedUrl, jobUploadFilename, jobUploadPath } from "@/lib/jobUploads";
import type { SocialMediaItem } from "./types";

export type ProjectLibraryItem = {
  /** Job id — the canonical project id used in routing. */
  job_id: string;
  flyer_id: string | null;
  kind: "flyer" | "upload";
  title: string;
  /** Preview/media URL: public flyer thumbnail, or a signed job-upload URL. */
  media_url: string | null;
  media_type: "image" | "video";
  category: string | null;
  status: string | null;
  share_unlocked: boolean;
  created_at: string;
};

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi)(\?|$)/i;

/** Same readiness rule as My Projects: paid/completed/delivered or unlocked. */
export function isPostableJob(job: { status?: string | null; share_unlocked?: boolean | null }) {
  return !!job.share_unlocked || ["paid", "completed", "delivered"].includes(job.status ?? "");
}

/**
 * Every project the signed-in customer can post, newest first.
 * Includes jobs they own directly and admin-created jobs on flyers they own.
 */
export async function fetchProjectLibrary(): Promise<ProjectLibraryItem[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const select =
    "id, title, status, share_unlocked, flyer_id, upload_url, created_at, flyer:flyers(id, title, thumbnail_url, category, status)";

  const [own, viaFlyer] = await Promise.all([
    supabase
      .from("jobs")
      .select(select)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("jobs")
      .select(
        "id, title, status, share_unlocked, flyer_id, upload_url, created_at, flyer:flyers!inner(id, title, thumbnail_url, category, status, owner_id)",
      )
      .eq("flyer.owner_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const byId = new Map<string, any>();
  for (const j of [...(own.data ?? []), ...(viaFlyer.data ?? [])]) byId.set(j.id, j);

  const eligible = [...byId.values()].filter(isPostableJob);

  // Collapse duplicate jobs pointing at the same flyer (keep the most advanced).
  const rank = (j: any) =>
    (j.share_unlocked ? 2 : 0) + (["paid", "completed", "delivered"].includes(j.status) ? 1 : 0);
  const byFlyer = new Map<string, any>();
  const standalone: any[] = [];
  for (const j of eligible) {
    if (!j.flyer_id) { standalone.push(j); continue; }
    const prev = byFlyer.get(j.flyer_id);
    if (!prev || rank(j) > rank(prev)) byFlyer.set(j.flyer_id, j);
  }
  const rows = [...standalone, ...byFlyer.values()].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

  // Resolve media: flyer thumbnails are public, uploads need a signed URL.
  const items = await Promise.all(
    rows.map(async (j): Promise<ProjectLibraryItem> => {
      const flyer = Array.isArray(j.flyer) ? j.flyer[0] : j.flyer;
      const hasFlyerMedia = typeof flyer?.thumbnail_url === "string" && flyer.thumbnail_url.startsWith("http");
      let mediaUrl: string | null = hasFlyerMedia ? flyer.thumbnail_url : null;
      let mediaType: "image" | "video" = "image";
      let kind: "flyer" | "upload" = j.flyer_id ? "flyer" : "upload";

      if (!mediaUrl && j.upload_url) {
        kind = j.flyer_id ? "flyer" : "upload";
        mediaUrl = await getJobUploadSignedUrl(j.upload_url, 3600);
        if (VIDEO_EXT.test(jobUploadPath(j.upload_url))) mediaType = "video";
      }

      return {
        job_id: j.id,
        flyer_id: j.flyer_id ?? null,
        kind,
        title: j.title || flyer?.title || "Untitled project",
        media_url: mediaUrl,
        media_type: mediaType,
        category: flyer?.category ?? null,
        status: j.status ?? null,
        share_unlocked: !!j.share_unlocked,
        created_at: j.created_at,
      };
    }),
  );

  return items;
}

/** The project's own asset as composer media (never copied or re-uploaded). */
export function projectMedia(item: ProjectLibraryItem): SocialMediaItem | null {
  if (!item.media_url) return null;
  return {
    type: item.media_type,
    url: item.media_url,
    mime_type: item.media_type === "video" ? "video/mp4" : "image/jpeg",
    file_name: `${item.title}.${item.media_type === "video" ? "mp4" : "jpg"}`,
  };
}

export { jobUploadFilename };
