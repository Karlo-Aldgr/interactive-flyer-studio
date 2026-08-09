import type { AdapterContext, PlatformResult } from "../types.ts";
import { primaryMedia } from "../types.ts";
import { resolveMetaPageCredentials } from "../../metaCredentials.ts";
import { extractLinkFromDraft, postFacebookToPage } from "../../metaFacebookPost.ts";

function providerError(payload: Record<string, unknown>, fallback: string) {
  if (payload.error && typeof payload.error === "object") {
    return String((payload.error as Record<string, unknown>).message || fallback).slice(0, 500);
  }
  return String(payload.error || fallback).slice(0, 500);
}

/** Facebook Page adapter: images, videos and link posts. */
export async function publishToFacebook(ctx: AdapterContext): Promise<PlatformResult> {
  const attempt_at = new Date().toISOString();
  const creds = await resolveMetaPageCredentials(ctx.supabase, ctx.ownerId, ctx.actorId);
  if ("error" in creds) {
    return { platform: "facebook", status: "not_connected", error: creds.error, attempt_at };
  }

  const message = ctx.caption.trim();
  const item = primaryMedia(ctx.media);

  if (item?.type === "video") {
    const params = new URLSearchParams({
      access_token: creds.pageAccessToken,
      file_url: item.url,
      description: message,
    });
    const res = await fetch(
      `https://graph-video.facebook.com/${ctx.graphVersion}/${creds.pageId}/videos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok || typeof json.id !== "string") {
      return {
        platform: "facebook",
        status: "failed",
        error: providerError(json, "Facebook video upload failed"),
        attempt_at,
        token_source: creds.source,
      };
    }
    return {
      platform: "facebook",
      status: "success",
      post_id: json.id,
      attempt_at,
      token_source: creds.source,
    };
  }

  if (!message && !item) {
    return { platform: "facebook", status: "failed", error: "Nothing to post", attempt_at };
  }

  const link = ctx.link || extractLinkFromDraft({}, message);
  const result = await postFacebookToPage({
    pageId: creds.pageId,
    pageAccessToken: creds.pageAccessToken,
    graphVersion: ctx.graphVersion,
    message,
    link,
    thumbnailUrl: item?.url,
  });

  if (!result.ok) {
    return {
      platform: "facebook",
      status: "failed",
      error: result.error,
      attempt_at: result.attemptAt,
      token_source: creds.source,
    };
  }
  return {
    platform: "facebook",
    status: "success",
    post_id: result.provider_post_id,
    attempt_at: result.attemptAt,
    token_source: creds.source,
  };
}
