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
import { expiresAtFrom, fetchJson, mapHttpError, requireEnv } from "../http.ts";

const API = "https://open.tiktokapis.com/v2";
const SECRETS = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"];
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

export const tiktokAdapter: SocialPlatformAdapter = {
  platform: "tiktok",
  requiredSecrets: SECRETS,
  defaultScopes: SCOPES,
  approvalNotes:
    "TikTok for Developers app needs the Content Posting API product. Until the app passes audit, posts can only be created with a SELF_ONLY (private) audience.",
  developerConsoleUrl: "https://developers.tiktok.com/apps",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", (env as Record<string, string>).TIKTOK_CLIENT_KEY);
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return { ok: true, authorize_url: url.toString() };
  },

  async handleCallback(input) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as Record<string, string>;
    const res = await fetchJson(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: secrets.TIKTOK_CLIENT_KEY,
        client_secret: secrets.TIKTOK_CLIENT_SECRET,
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
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    if (!account.refresh_token) {
      return adapterError("auth_expired", "Reconnect TikTok — no refresh token is stored.");
    }
    const secrets = env as Record<string, string>;
    const res = await fetchJson(`${API}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: secrets.TIKTOK_CLIENT_KEY,
        client_secret: secrets.TIKTOK_CLIENT_SECRET,
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
    const creator = await fetchJson(`${API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    });
    if (!creator.ok) {
      return mapHttpError(
        creator,
        "TikTok would not confirm this creator's posting permissions",
        tiktokMessage(creator.body, ""),
      );
    }
    const info = (creator.body.data ?? {}) as Record<string, unknown>;
    const options = Array.isArray(info.privacy_level_options)
      ? (info.privacy_level_options as string[])
      : [];
    const requested = String(input.options.privacy_level || "");
    const privacy = options.includes(requested)
      ? requested
      : (options.includes("SELF_ONLY") ? "SELF_ONLY" : options[0] || "SELF_ONLY");
    const maxDuration = typeof info.max_video_post_duration_sec === "number"
      ? info.max_video_post_duration_sec
      : null;

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
      return {
        ok: true,
        remote_post_id: initData.publish_id,
        remote_post_url: null,
        native_scheduled: false,
      };
    }

    // Photo posts must be pulled from a public HTTPS URL.
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
          photo_images: media.filter((m) => m.type === "image").map((m) => m.url),
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    });
    const publishId = (res.body.data as { publish_id?: string } | undefined)?.publish_id;
    if (!res.ok || !publishId) {
      return mapHttpError(res, "TikTok rejected the post", tiktokMessage(res.body, ""));
    }
    return { ok: true, remote_post_id: publishId, remote_post_url: null, native_scheduled: false };
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
    return { ok: true, status: String(data?.status || "unknown"), remote_post_url: null };
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
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as Record<string, string>;
    const res = await fetchJson(`${API}/oauth/revoke/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: secrets.TIKTOK_CLIENT_KEY,
        client_secret: secrets.TIKTOK_CLIENT_SECRET,
        token: account.access_token,
      }).toString(),
    });
    if (!res.ok) return mapHttpError(res, "TikTok could not revoke the token");
    return { ok: true };
  },
};
