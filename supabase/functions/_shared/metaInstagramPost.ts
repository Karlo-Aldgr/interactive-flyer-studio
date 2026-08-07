import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { resolveStoredInstagramToken } from "./metaInstagramToken.ts";

export type InstagramTokenSource = "instagram_login" | "facebook_page";

export type InstagramPostResult =
  | {
    ok: true;
    provider_post_id: string;
    attemptAt: string;
    token_source: InstagramTokenSource;
  }
  | {
    ok: false;
    error: string;
    attemptAt: string;
    token_source?: InstagramTokenSource;
  };

function providerErrorMessage(payload: Record<string, unknown>, fallback: string) {
  if (payload.error && typeof payload.error === "object") {
    return String((payload.error as Record<string, unknown>).message || fallback).slice(0, 500);
  }
  return String(payload.error || fallback).slice(0, 500);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPublicHttpUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Prefer stored/refreshed Instagram Login token; fall back to Facebook Page token. */
export async function resolveInstagramAccess(args: {
  supabase: SupabaseClient;
  userId?: string | null;
  pageAccessToken?: string | null;
}): Promise<{
  accessToken: string;
  apiHost: string;
  tokenSource: InstagramTokenSource;
  expiresAt: string | null;
} | { error: string }> {
  const stored = await resolveStoredInstagramToken(args.supabase, args.userId);
  if (!("error" in stored)) {
    return {
      accessToken: stored.accessToken,
      apiHost: "graph.instagram.com",
      tokenSource: "instagram_login",
      expiresAt: stored.expiresAt,
    };
  }

  const pageToken = args.pageAccessToken?.trim() || "";
  if (pageToken) {
    return {
      accessToken: pageToken,
      apiHost: "graph.facebook.com",
      tokenSource: "facebook_page",
      expiresAt: null,
    };
  }

  return { error: stored.error };
}

export async function postInstagramImage(args: {
  igUserId: string;
  caption: string;
  imageUrl: string;
  graphVersion: string;
  accessToken: string;
  apiHost: string;
  tokenSource: InstagramTokenSource;
}): Promise<InstagramPostResult> {
  return postInstagramMedia({ ...args, mediaType: "image", mediaUrl: args.imageUrl });
}

/** Publish a single image or video (Reel) to an Instagram Business account. */
export async function postInstagramMedia(args: {
  igUserId: string;
  caption: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  graphVersion: string;
  accessToken: string;
  apiHost: string;
  tokenSource: InstagramTokenSource;
}): Promise<InstagramPostResult> {
  const attemptAt = new Date().toISOString();
  const caption = args.caption.trim();
  const imageUrl = args.mediaUrl.trim();
  const igUserId = args.igUserId.trim();

  if (!igUserId) return { ok: false, error: "Instagram User ID is missing", attemptAt };
  if (!caption) return { ok: false, error: "No Instagram caption is ready yet", attemptAt };
  if (!isPublicHttpUrl(imageUrl)) {
    return {
      ok: false,
      error:
        "Instagram needs a public media URL. Publish/regenerate so the media URL is publicly reachable (not a local LAN URL).",
      attemptAt,
    };
  }

  async function igPost(path: string, body: Record<string, string>) {
    const url = `https://${args.apiHost}/${args.graphVersion}/${path}`;
    if (args.tokenSource === "instagram_login") {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { res, data };
    }
    const params = new URLSearchParams({ ...body, access_token: args.accessToken });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { res, data };
  }

  async function igGet(path: string, fields?: string) {
    const url = new URL(`https://${args.apiHost}/${args.graphVersion}/${path}`);
    if (fields) url.searchParams.set("fields", fields);
    if (args.tokenSource === "instagram_login") {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${args.accessToken}` },
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { res, data };
    }
    url.searchParams.set("access_token", args.accessToken);
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { res, data };
  }

  async function waitForContainerReady(containerId: string) {
    let lastStatus = "UNKNOWN";
    for (let i = 0; i < 20; i++) {
      if (i > 0) await sleep(2500);
      const { res, data } = await igGet(containerId, "status_code,status");
      lastStatus = String(data.status_code || data.status || "UNKNOWN");
      if (!res.ok) {
        return {
          ok: false as const,
          error: providerErrorMessage(data, "Container status check failed"),
        };
      }
      if (lastStatus === "FINISHED") return { ok: true as const };
      if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
        return {
          ok: false as const,
          error: providerErrorMessage(
            data,
            `Instagram media container ${lastStatus}. Check image is a public JPEG URL.`,
          ),
        };
      }
    }
    return {
      ok: false as const,
      error: `Instagram media container not ready (last status: ${lastStatus}). Try again in a few seconds.`,
    };
  }

  const createBody: Record<string, string> = args.mediaType === "video"
    ? { media_type: "REELS", video_url: imageUrl, caption }
    : { image_url: imageUrl, caption };
  const { res: createRes, data: createJson } = await igPost(`${igUserId}/media`, createBody);
  if (!createRes.ok || typeof createJson.id !== "string") {
    return {
      ok: false,
      error: providerErrorMessage(createJson, "Instagram media create failed"),
      attemptAt,
      token_source: args.tokenSource,
    };
  }

  const ready = await waitForContainerReady(createJson.id);
  if (!ready.ok) {
    return { ok: false, error: ready.error, attemptAt, token_source: args.tokenSource };
  }

  let publishJson: Record<string, unknown> = {};
  let publishRes: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2000);
    const result = await igPost(`${igUserId}/media_publish`, {
      creation_id: createJson.id,
    });
    publishRes = result.res;
    publishJson = result.data;
    if (publishRes.ok && typeof publishJson.id === "string") break;
    const msg = providerErrorMessage(publishJson, "");
    if (!/media id is not available/i.test(msg)) break;
  }

  if (!publishRes?.ok || typeof publishJson.id !== "string") {
    return {
      ok: false,
      error: providerErrorMessage(publishJson, "Instagram media publish failed"),
      attemptAt,
      token_source: args.tokenSource,
    };
  }

  return {
    ok: true,
    provider_post_id: publishJson.id,
    attemptAt,
    token_source: args.tokenSource,
  };
}

export function instagramSuccessPatch(providerPostId: string, attemptAt: string) {
  return {
    instagram_status: "posted",
    instagram_posted_at: attemptAt,
    instagram_scheduled_for: null,
    instagram_error_message: null,
    instagram_provider_status: "posted",
    instagram_provider_post_id: providerPostId,
    instagram_last_attempt_at: attemptAt,
    instagram_last_error: null,
  };
}

export function instagramFailurePatch(error: string, attemptAt: string) {
  return {
    instagram_status: "failed",
    instagram_error_message: error,
    instagram_provider_status: "failed",
    instagram_last_attempt_at: attemptAt,
    instagram_last_error: error,
  };
}
