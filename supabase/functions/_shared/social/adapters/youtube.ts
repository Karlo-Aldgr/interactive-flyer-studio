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

const SECRETS = ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"];
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

async function uploadVideo(
  account: AdapterAccount,
  item: MediaItem,
  snippet: Record<string, unknown>,
  status: Record<string, unknown>,
): Promise<AdapterResult<{ videoId: string }>> {
  const file = await fetch(item.url);
  if (!file.ok) return adapterError("validation", "The video URL could not be downloaded.");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": String(bytes.byteLength),
        "X-Upload-Content-Type": item.mime_type || "video/*",
      },
      body: JSON.stringify({ snippet, status }),
    },
  );
  if (!init.ok) {
    const text = await init.text();
    return mapHttpError(
      { status: init.status, ok: false, body: safeJson(text) },
      "YouTube refused the upload session",
    );
  }
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) return adapterError("unknown", "YouTube did not return an upload URL.");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": item.mime_type || "video/*" },
    body: bytes,
  });
  const text = await put.text();
  const body = safeJson(text);
  if (!put.ok || typeof body.id !== "string") {
    return mapHttpError({ status: put.status, ok: false, body }, "YouTube rejected the video upload");
  }
  return { ok: true, videoId: body.id };
}

function safeJson(text: string): Record<string, unknown> {
  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export const youtubeAdapter: SocialPlatformAdapter = {
  platform: "youtube",
  requiredSecrets: SECRETS,
  defaultScopes: SCOPES,
  approvalNotes:
    "Google Cloud project needs the YouTube Data API v3 enabled and an OAuth consent screen. Until Google verifies the app, uploads are forced to a private privacy status and the app is limited to test users.",
  developerConsoleUrl: "https://console.cloud.google.com/apis/credentials",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", (env as Record<string, string>).YOUTUBE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return { ok: true, authorize_url: url.toString() };
  },

  async handleCallback(input) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as Record<string, string>;
    const res = await fetchJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: secrets.YOUTUBE_CLIENT_ID,
        client_secret: secrets.YOUTUBE_CLIENT_SECRET,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "Google rejected the authorization code");
    }
    const token = res.body.access_token;
    const channels = await fetchJson(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!channels.ok) return mapHttpError(channels, "Could not list your YouTube channels");
    const items = Array.isArray(channels.body.items)
      ? channels.body.items as Record<string, unknown>[]
      : [];
    if (!items.length) {
      return adapterError("permission_missing", "This Google account has no YouTube channel.");
    }
    return {
      ok: true,
      accounts: items.map((channel) => {
        const snippet = (channel.snippet ?? {}) as Record<string, unknown>;
        const thumbs = (snippet.thumbnails ?? {}) as Record<string, { url?: string }>;
        return {
          platform_account_id: String(channel.id),
          account_name: typeof snippet.title === "string" ? snippet.title : null,
          username: typeof snippet.customUrl === "string" ? snippet.customUrl : null,
          profile_image_url: thumbs.default?.url ?? null,
          access_token: token,
          refresh_token: typeof res.body.refresh_token === "string" ? res.body.refresh_token : null,
          token_expires_at: expiresAtFrom(res.body.expires_in),
          scopes: SCOPES,
          metadata: { statistics: channel.statistics ?? null },
        };
      }),
    };
  },

  async refreshToken(account) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    if (!account.refresh_token) {
      return adapterError("auth_expired", "Reconnect YouTube — no Google refresh token is stored.");
    }
    const secrets = env as Record<string, string>;
    const res = await fetchJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: secrets.YOUTUBE_CLIENT_ID,
        client_secret: secrets.YOUTUBE_CLIENT_SECRET,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }).toString(),
    });
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "Google refresh failed");
    }
    return {
      ok: true,
      access_token: res.body.access_token,
      refresh_token: account.refresh_token,
      token_expires_at: expiresAtFrom(res.body.expires_in),
    };
  },

  async getAccount(account) {
    const res = await fetchJson(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${account.platform_account_id}`,
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    if (!res.ok) return mapHttpError(res, "Could not read the YouTube channel");
    const channel = (Array.isArray(res.body.items) ? res.body.items[0] : {}) as Record<string, unknown>;
    const snippet = (channel?.snippet ?? {}) as Record<string, unknown>;
    const thumbs = (snippet.thumbnails ?? {}) as Record<string, { url?: string }>;
    return {
      ok: true,
      account: {
        account_name: typeof snippet.title === "string" ? snippet.title : null,
        username: typeof snippet.customUrl === "string" ? snippet.customUrl : null,
        profile_image_url: thumbs.default?.url ?? null,
        metadata: { statistics: channel?.statistics ?? null },
      },
    };
  },

  uploadMedia(account, item) {
    if (item.type !== "video") {
      return Promise.resolve(adapterError("unsupported", "YouTube only accepts video uploads."));
    }
    return uploadVideo(account, item, { title: "Untitled" }, { privacyStatus: "private" }).then((r) =>
      r.ok === false ? r : { ok: true as const, remote_media_id: r.videoId }
    );
  },

  async publishPost(account, input: PublishInput): Promise<AdapterResult<PublishSuccess>> {
    const video = input.media.find((m) => m.type === "video");
    if (!video) return adapterError("validation", "YouTube requires a video file.");
    const description = composeText(input.caption, input.hashtags, input.link);
    const title = String(input.options.title || input.caption || "TapThatFlyer video").slice(0, 100);
    const result = await uploadVideo(
      account,
      video,
      {
        title,
        description: description.slice(0, 5000),
        tags: input.hashtags.map((t) => t.replace(/^#/, "")).slice(0, 20),
      },
      { privacyStatus: String(input.options.privacy_status || "public"), selfDeclaredMadeForKids: false },
    );
    if (result.ok === false) return result;
    return {
      ok: true,
      remote_post_id: result.videoId,
      remote_post_url: `https://www.youtube.com/watch?v=${result.videoId}`,
      native_scheduled: false,
    };
  },

  async schedulePost(account, input): Promise<AdapterResult<PublishSuccess>> {
    const video = input.media.find((m) => m.type === "video");
    if (!video) return adapterError("validation", "YouTube requires a video file.");
    if (!input.scheduledAt) return adapterError("validation", "A scheduled time is required.");
    const description = composeText(input.caption, input.hashtags, input.link);
    const title = String(input.options.title || input.caption || "TapThatFlyer video").slice(0, 100);
    const result = await uploadVideo(
      account,
      video,
      { title, description: description.slice(0, 5000) },
      {
        privacyStatus: "private",
        publishAt: new Date(input.scheduledAt).toISOString(),
        selfDeclaredMadeForKids: false,
      },
    );
    if (result.ok === false) return result;
    return {
      ok: true,
      remote_post_id: result.videoId,
      remote_post_url: `https://www.youtube.com/watch?v=${result.videoId}`,
      native_scheduled: true,
    };
  },

  async deletePost(account, remotePostId) {
    const res = await fetchJson(
      `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(remotePostId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    if (!res.ok && res.status !== 204) return mapHttpError(res, "YouTube could not delete the video");
    return { ok: true };
  },

  async getPostStatus(account, remotePostId) {
    const res = await fetchJson(
      `https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${remotePostId}`,
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    if (!res.ok) return mapHttpError(res, "Could not read the YouTube video");
    const item = (Array.isArray(res.body.items) ? res.body.items[0] : {}) as Record<string, unknown>;
    const status = (item?.status ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: String(status.uploadStatus || "unknown"),
      remote_post_url: `https://www.youtube.com/watch?v=${remotePostId}`,
    };
  },

  async getAnalytics(account, remotePostId) {
    const res = await fetchJson(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${remotePostId}`,
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    if (!res.ok) return mapHttpError(res, "YouTube statistics are unavailable for this video");
    const item = (Array.isArray(res.body.items) ? res.body.items[0] : {}) as Record<string, unknown>;
    const stats = (item?.statistics ?? {}) as Record<string, string>;
    const num = (v: string | undefined) => (v === undefined ? null : Number(v));
    const snapshot = emptyAnalytics(stats);
    snapshot.video_views = num(stats.viewCount);
    snapshot.likes = num(stats.likeCount);
    snapshot.comments = num(stats.commentCount);
    return { ok: true, ...snapshot };
  },

  async revoke(account) {
    const res = await fetchJson(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(account.access_token)}`,
      { method: "POST" },
    );
    if (!res.ok) return mapHttpError(res, "Google could not revoke the token");
    return { ok: true };
  },
};
