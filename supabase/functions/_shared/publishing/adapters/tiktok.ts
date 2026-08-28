import type { AdapterContext, PlatformResult } from "../types.ts";
import { primaryMedia } from "../types.ts";
import { resolveTikTokAccessToken } from "../../tiktokCredentials.ts";
import {
  fetchTikTokCreatorInfo,
  resolveTikTokPrivacy,
} from "../../social/adapters/tiktok.ts";
import { toTikTokMediaUrl } from "../../tiktokMedia.ts";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

function tiktokError(payload: Record<string, unknown>, fallback: string) {
  const err = payload.error as Record<string, unknown> | undefined;
  if (err && typeof err === "object") {
    const code = String(err.code || "");
    const message = String(err.message || "");
    if (code && code !== "ok") return `${code}: ${message || fallback}`.slice(0, 500);
    if (message) return message.slice(0, 500);
  }
  return fallback;
}

/** TikTok Content Posting API adapter (PULL_FROM_URL for videos and photos). */
export async function publishToTikTok(ctx: AdapterContext): Promise<PlatformResult> {
  const attempt_at = new Date().toISOString();
  const item = primaryMedia(ctx.media);
  if (!item) {
    return {
      platform: "tiktok",
      status: "failed",
      error: "TikTok requires a video or image",
      attempt_at,
    };
  }

  const token = await resolveTikTokAccessToken(ctx.supabase, ctx.ownerId);
  if ("error" in token) {
    return { platform: "tiktok", status: "not_connected", error: token.error, attempt_at };
  }

  const creator = await fetchTikTokCreatorInfo(token.accessToken);
  if (creator.ok === false) {
    return { platform: "tiktok", status: "failed", error: creator.message, attempt_at };
  }
  const chosen = resolveTikTokPrivacy(creator.info.privacy_level_options, "");
  if ("error" in chosen) {
    return { platform: "tiktok", status: "failed", error: chosen.error, attempt_at };
  }
  const privacyLevel = chosen.privacy;

  const caption = ctx.caption.trim().slice(0, 2200);
  // TikTok can only pull from a URL prefix TapThatFlyer owns and verified.
  const mediaUrl = await toTikTokMediaUrl(item.url);
  const isVideo = item.type === "video";
  const endpoint = isVideo
    ? `${TIKTOK_API}/post/publish/video/init/`
    : `${TIKTOK_API}/post/publish/content/init/`;

  const body: Record<string, unknown> = isVideo
    ? {
      post_info: { title: caption, privacy_level: privacyLevel },
      source_info: { source: "PULL_FROM_URL", video_url: mediaUrl },
    }
    : {
      post_info: { title: caption, privacy_level: privacyLevel },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: [mediaUrl] },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const publishId = typeof data?.publish_id === "string" ? data.publish_id : "";

  if (!res.ok || !publishId) {
    return {
      platform: "tiktok",
      status: "failed",
      error: tiktokError(json, `TikTok publish failed (HTTP ${res.status})`),
      attempt_at,
      token_source: "tiktok_oauth",
    };
  }

  return {
    platform: "tiktok",
    status: "success",
    post_id: publishId,
    attempt_at,
    token_source: "tiktok_oauth",
  };
}
