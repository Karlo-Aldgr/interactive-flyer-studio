import {
  adapterError,
  type AdapterError,
  type AdapterAccount,
  type AdapterResult,
  type AuthStartInput,
  composeText,
  emptyAnalytics,
  type MediaItem,
  type PublishInput,
  type PublishSuccess,
  type SocialPlatformAdapter,
} from "../types.ts";
import { expiresAtFrom, fetchJson, mapHttpError } from "../http.ts";
import { tiktokAudited, tiktokCredentials, tiktokSecretNames } from "../../tiktokEnv.ts";
import { toTikTokMediaUrl } from "../../tiktokMedia.ts";

/** Resolves Sandbox or Production TikTok credentials based on TIKTOK_ENV. */
function requireTikTokCreds(): { clientKey: string; clientSecret: string } | AdapterError {
  const creds = tiktokCredentials();
  if ("missing" in creds) {
    return adapterError(
      "not_configured",
      `Missing server credentials: ${creds.missing.join(", ")}. Add them in Project Settings → Secrets.`,
    );
  }
  return { clientKey: creds.clientKey, clientSecret: creds.clientSecret };
}

const API = "https://open.tiktokapis.com/v2";
const SECRETS = [tiktokSecretNames().keyName, tiktokSecretNames().secretName];
const SCOPES = ["user.info.basic", "video.publish", "video.upload"];

function tiktokMessage(body: Record<string, unknown>, fallback: string) {
  const err = body.error as Record<string, unknown> | undefined;
  if (err && typeof err === "object") {
    const code = String(err.code || "");
    const message = String(err.message || "");
    if (code && code !== "ok") return `${code}: ${message || fallback}`;
    if (message) return message;
  }
  return fallback;
}

export type TikTokCreatorInfo = {
  creator_username: string | null;
  creator_nickname: string | null;
  creator_avatar_url: string | null;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number | null;
};

/** POST /v2/post/publish/creator_info/query/ — the source of truth for audience options. */
export async function fetchTikTokCreatorInfo(
  accessToken: string,
): Promise<{ ok: true; info: TikTokCreatorInfo } | AdapterError> {
  const res = await fetchJson(`${API}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  if (!res.ok) {
    return mapHttpError(
      res,
      "TikTok would not confirm this creator's posting permissions",
      tiktokMessage(res.body, ""),
    );
  }
  const data = (res.body.data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    ok: true,
    info: {
      creator_username: str(data.creator_username),
      creator_nickname: str(data.creator_nickname),
      creator_avatar_url: str(data.creator_avatar_url),
      privacy_level_options: Array.isArray(data.privacy_level_options)
        ? (data.privacy_level_options as unknown[]).map((v) => String(v))
        : [],
      comment_disabled: data.comment_disabled === true,
      duet_disabled: data.duet_disabled === true,
      stitch_disabled: data.stitch_disabled === true,
      max_video_post_duration_sec: typeof data.max_video_post_duration_sec === "number"
        ? data.max_video_post_duration_sec
        : null,
    },
  };
}

/**
 * Unaudited TikTok apps (Sandbox, or production before approval) may only
 * create private posts; anything else fails with
 * `unaudited_client_can_only_post_to_private_accounts`.
 */
export function resolveTikTokPrivacy(
  options: string[],
  requested: string,
): { privacy: string } | { error: string } {
  if (!tiktokAudited()) {
    if (options.length && !options.includes("SELF_ONLY")) {
      return {
        error:
          "This TikTok account does not offer the private (“Only me”) audience, which is the only audience an unaudited TikTok app may post to. Connect a TikTok account that allows private posts, or publish after TikTok approves the app.",
      };
    }
    return { privacy: "SELF_ONLY" };
  }
  if (requested && options.includes(requested)) return { privacy: requested };
  if (options.includes("SELF_ONLY")) return { privacy: "SELF_ONLY" };
  if (options.length) return { privacy: options[0] };
  return { privacy: "SELF_ONLY" };
}

export type TikTokPublishStatus = {
  status: string;
  fail_reason: string | null;
  post_ids: string[];
  uploaded_bytes: number | null;
  raw: Record<string, unknown>;
};

/**
 * POST /v2/post/publish/status/fetch/ — the ONLY authoritative signal that a
 * TikTok post actually landed. `publish_id` from init means "accepted", not
 * "published": TikTok can still fail during transcode/moderation.
 */
export async function fetchTikTokPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<{ ok: true; status: TikTokPublishStatus } | AdapterError> {
  const res = await fetchJson(`${API}/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  if (!res.ok) {
    return mapHttpError(
      res,
      "Could not read the TikTok publish status",
      tiktokMessage(res.body, ""),
    );
  }
  const data = (res.body.data ?? {}) as Record<string, unknown>;
  const ids = data.publicaly_available_post_id ?? data.publicly_available_post_id;
  return {
    ok: true,
    status: {
      status: String(data.status || "unknown"),
      fail_reason: typeof data.fail_reason === "string" && data.fail_reason
        ? data.fail_reason
        : null,
      post_ids: Array.isArray(ids) ? (ids as unknown[]).map((v) => String(v)) : [],
      uploaded_bytes: typeof data.uploaded_bytes === "number" ? data.uploaded_bytes : null,
      raw: data,
    },
  };
}

export type TikTokPollOutcome =
  | { kind: "complete"; postId: string | null; status: TikTokPublishStatus }
  | { kind: "failed"; message: string; status: TikTokPublishStatus }
  | { kind: "pending"; message: string; status: TikTokPublishStatus | null };

/**
 * Polls the publish status until TikTok reports PUBLISH_COMPLETE or FAILED.
 * Never claims success on a still-processing post — the caller must surface
 * "pending" as an in-progress state, not as "published".
 */
export async function pollTikTokPublish(
  accessToken: string,
  publishId: string,
  opts: { attempts?: number; intervalMs?: number } = {},
): Promise<TikTokPollOutcome> {
  const attempts = opts.attempts ?? 10;
  const intervalMs = opts.intervalMs ?? 3000;
  let last: TikTokPublishStatus | null = null;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetchTikTokPublishStatus(accessToken, publishId);
    if ("ok" in res && res.ok === false) {
      console.error(`[tiktok] status/fetch error for ${publishId}: ${(res as AdapterError).message}`);
      continue;
    }
    last = (res as { ok: true; status: TikTokPublishStatus }).status;
    console.log(
      `[tiktok] publish_id=${publishId} attempt=${i + 1} status=${last.status}` +
        (last.fail_reason ? ` fail_reason=${last.fail_reason}` : "") +
        (last.uploaded_bytes !== null ? ` uploaded_bytes=${last.uploaded_bytes}` : ""),
    );
    if (last.status === "PUBLISH_COMPLETE") {
      return { kind: "complete", postId: last.post_ids[0] ?? null, status: last };
    }
    if (last.status === "FAILED") {
      return {
        kind: "failed",
        message: `TikTok failed to publish the post: ${last.fail_reason || "no fail_reason returned"}.`,
        status: last,
      };
    }
  }

  return {
    kind: "pending",
    message:
      `TikTok is still processing this post (last status: ${last?.status ?? "unknown"}). ` +
      "It has not been published yet — TapThatFlyer will keep checking.",
    status: last,
  };
}




export const tiktokAdapter: SocialPlatformAdapter = {
  platform: "tiktok",
  requiredSecrets: SECRETS,
  defaultScopes: SCOPES,
  approvalNotes:
    "TikTok for Developers app needs the Content Posting API product. Until the app passes audit, posts can only be created with a SELF_ONLY (private) audience.",
  developerConsoleUrl: "https://developers.tiktok.com/apps",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const env = requireTikTokCreds();
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", (env as { clientKey: string }).clientKey);
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return { ok: true, authorize_url: url.toString() };
  },

  async handleCallback(input) {
    const env = requireTikTokCreds();
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as { clientKey: string; clientSecret: string };
    const res = await fetchJson(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: secrets.clientKey,
        client_secret: secrets.clientSecret,
        code: input.code,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
      }).toString(),
    });
    const accessToken = typeof res.body.access_token === "string" ? res.body.access_token : "";
    if (!res.ok || !accessToken) {
      return mapHttpError(res, "TikTok rejected the authorization code", tiktokMessage(res.body, ""));
    }
    const openId = String(res.body.open_id || "");
    const info = await fetchJson(
      `${API}/user/info/?fields=open_id,union_id,display_name,avatar_url,username`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const user = (info.body.data as { user?: Record<string, unknown> } | undefined)?.user ?? {};
    return {
      ok: true,
      accounts: [{
        platform_account_id: openId || String(user.open_id || "tiktok"),
        account_name: typeof user.display_name === "string" ? user.display_name : null,
        username: typeof user.username === "string" ? user.username : null,
        profile_image_url: typeof user.avatar_url === "string" ? user.avatar_url : null,
        access_token: accessToken,
        refresh_token: typeof res.body.refresh_token === "string" ? res.body.refresh_token : null,
        token_expires_at: expiresAtFrom(res.body.expires_in),
        scopes: String(res.body.scope || SCOPES.join(",")).split(","),
        metadata: { union_id: user.union_id ?? null },
      }],
    };
  },

  async refreshToken(account) {
    const env = requireTikTokCreds();
    if ("ok" in env && env.ok === false) return env as AdapterError;
    if (!account.refresh_token) {
      return adapterError("auth_expired", "Reconnect TikTok — no refresh token is stored.");
    }
    const secrets = env as { clientKey: string; clientSecret: string };

    const res = await fetchJson(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: secrets.clientKey,
        client_secret: secrets.clientSecret,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }).toString(),
    });
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "TikTok refresh failed", tiktokMessage(res.body, ""));
    }
    return {
      ok: true,
      access_token: res.body.access_token,
      refresh_token: typeof res.body.refresh_token === "string"
        ? res.body.refresh_token
        : account.refresh_token,
      token_expires_at: expiresAtFrom(res.body.expires_in),
    };
  },

  async getAccount(account) {
    const res = await fetchJson(
      `${API}/user/info/?fields=open_id,display_name,avatar_url,username,follower_count`,
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    if (!res.ok) return mapHttpError(res, "Could not read the TikTok profile");
    const user = (res.body.data as { user?: Record<string, unknown> } | undefined)?.user ?? {};
    return {
      ok: true,
      account: {
        account_name: typeof user.display_name === "string" ? user.display_name : null,
        username: typeof user.username === "string" ? user.username : null,
        profile_image_url: typeof user.avatar_url === "string" ? user.avatar_url : null,
        metadata: { follower_count: user.follower_count ?? null },
      },
    };
  },

  uploadMedia(_account: AdapterAccount, item: MediaItem) {
    // TikTok pulls the file from a public URL during init — no pre-upload call.
    return Promise.resolve({ ok: true as const, remote_media_id: item.url });
  },

  async publishPost(account, input: PublishInput): Promise<AdapterResult<PublishSuccess>> {
    const media = input.media;
    if (!media.length) return adapterError("validation", "TikTok requires a video or image.");
    const scopes = (account.scopes ?? []).map((s) => s.trim());
    if (scopes.length && !scopes.includes("video.publish")) {
      return adapterError(
        "approval_required",
        "TikTok direct publishing is pending TikTok app approval (the video.publish permission has not been granted to this connection yet).",
      );
    }
    const title = composeText(input.caption, input.hashtags, null).slice(0, 2200);
    const video = media.find((m) => m.type === "video");

    // Creator info drives the allowed privacy levels and interaction settings.
    const creator = await fetchTikTokCreatorInfo(account.access_token);
    if ("ok" in creator && creator.ok === false) return creator as AdapterError;
    const info = (creator as { ok: true; info: TikTokCreatorInfo }).info;
    const options = info.privacy_level_options;
    const resolved = resolveTikTokPrivacy(options, String(input.options.privacy_level || ""));
    if ("error" in resolved) {
      return adapterError("validation", resolved.error);
    }
    const privacy = resolved.privacy;
    const maxDuration = info.max_video_post_duration_sec;


    const postInfo: Record<string, unknown> = {
      title,
      privacy_level: privacy,
      disable_comment: info.comment_disabled === true,
      disable_duet: info.duet_disabled === true,
      disable_stitch: info.stitch_disabled === true,
    };

    if (video) {
      // FILE_UPLOAD avoids TikTok's verified URL-prefix requirement for PULL_FROM_URL.
      const file = await fetch(video.url);
      if (!file.ok) {
        return adapterError("transient", "TapThatFlyer could not read the selected video file.");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!bytes.byteLength) return adapterError("validation", "The selected video file is empty.");
      const init = await fetchJson(`${API}/post/publish/video/init/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: postInfo,
          source_info: {
            source: "FILE_UPLOAD",
            video_size: bytes.byteLength,
            chunk_size: bytes.byteLength,
            total_chunk_count: 1,
          },
        }),
      });
      const initData = init.body.data as
        | { publish_id?: string; upload_url?: string }
        | undefined;
      if (!init.ok || !initData?.publish_id || !initData?.upload_url) {
        return mapHttpError(init, "TikTok rejected the video post", tiktokMessage(init.body, ""));
      }
      const put = await fetch(initData.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": video.mime_type || "video/mp4",
          "Content-Length": String(bytes.byteLength),
          "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
        },
        body: bytes,
      });
      if (!put.ok) {
        return adapterError(
          put.status >= 500 ? "transient" : "validation",
          `TikTok could not accept the video upload (HTTP ${put.status})${
            maxDuration ? `. Videos must be under ${maxDuration}s.` : ""
          }`,
        );
      }
      // The upload PUT only means TikTok received bytes. Confirm the real
      // outcome with status/fetch before reporting success anywhere.
      const outcome = await pollTikTokPublish(account.access_token, initData.publish_id);
      if (outcome.kind === "failed") {
        return adapterError("validation", outcome.message);
      }
      const videoPostId = outcome.kind === "complete" ? outcome.postId : null;
      return {
        ok: true,
        remote_post_id: initData.publish_id,
        remote_post_url: videoPostId && account.username
          ? `https://www.tiktok.com/@${account.username}/video/${videoPostId}`
          : null,
        native_scheduled: false,
        pending: outcome.kind === "pending",
        pending_message: outcome.kind === "pending" ? outcome.message : undefined,
      };
    }


    // Photo posts must be pulled from a TapThatFlyer-owned HTTPS URL prefix.
    const photoUrls = await Promise.all(
      media.filter((m) => m.type === "image").map((m) => toTikTokMediaUrl(m.url)),
    );
    const res = await fetchJson(`${API}/post/publish/content/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: postInfo,
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: photoUrls,
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    });
    const publishId = (res.body.data as { publish_id?: string } | undefined)?.publish_id;
    if (!res.ok || !publishId) {
      return mapHttpError(res, "TikTok rejected the post", tiktokMessage(res.body, ""));
    }
    const photoOutcome = await pollTikTokPublish(account.access_token, publishId);
    if (photoOutcome.kind === "failed") {
      return adapterError("validation", photoOutcome.message);
    }
    const photoPostId = photoOutcome.kind === "complete" ? photoOutcome.postId : null;
    return {
      ok: true,
      remote_post_id: publishId,
      remote_post_url: photoPostId && account.username
        ? `https://www.tiktok.com/@${account.username}/video/${photoPostId}`
        : null,
      native_scheduled: false,
      pending: photoOutcome.kind === "pending",
      pending_message: photoOutcome.kind === "pending" ? photoOutcome.message : undefined,
    };
  },


  schedulePost() {
    return Promise.resolve(
      adapterError(
        "unsupported",
        "TikTok's Content Posting API has no scheduling parameter — TapThatFlyer queues the post instead.",
      ),
    );
  },

  deletePost() {
    return Promise.resolve(
      adapterError("unsupported", "TikTok does not allow deleting posts through the API."),
    );
  },

  async getPostStatus(account, remotePostId) {
    const res = await fetchJson(`${API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: remotePostId }),
    });
    if (!res.ok) return mapHttpError(res, "Could not read the TikTok publish status");
    const data = res.body.data as Record<string, unknown> | undefined;
    const raw = String(data?.status || "unknown");
    // Normalize TikTok's publish states onto publishing / published / failed.
    const status = raw === "PUBLISH_COMPLETE"
      ? "published"
      : raw === "FAILED"
      ? "failed"
      : raw === "unknown"
      ? "unknown"
      : "publishing";
    const ids = data?.publicaly_available_post_id ?? data?.publicly_available_post_id;
    const postId = Array.isArray(ids) && ids.length ? String(ids[0]) : null;
    const url = postId && account.username
      ? `https://www.tiktok.com/@${account.username}/video/${postId}`
      : null;

    return { ok: true, status, remote_post_url: url };
  },


  getAnalytics() {
    return Promise.resolve({
      ok: true as const,
      ...emptyAnalytics({
        note: "TikTok post metrics require the Display API video.list scope, which this app has not been granted.",
      }),
    });
  },

  async revoke(account) {
    const env = requireTikTokCreds();
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as { clientKey: string; clientSecret: string };
    const res = await fetchJson(`${API}/oauth/revoke/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: secrets.clientKey,
        client_secret: secrets.clientSecret,
        token: account.access_token,
      }).toString(),
    });
    if (!res.ok) return mapHttpError(res, "TikTok could not revoke the token");
    return { ok: true };
  },
};
