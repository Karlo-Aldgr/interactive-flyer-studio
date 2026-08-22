import {
  adapterError,
  type AdapterError,
  type AdapterAccount,
  type AdapterResult,
  type AnalyticsSnapshot,
  type AuthStartInput,
  type CallbackInput,
  composeText,
  emptyAnalytics,
  type MediaItem,
  type PublishInput,
  type PublishSuccess,
  type ResolvedAccount,
  type SocialPlatformAdapter,
} from "../types.ts";
import { expiresAtFrom, fetchJson, mapHttpError, requireEnv } from "../http.ts";

const GRAPH = () =>
  Deno.env.get("SOCIAL_META_GRAPH_API_VERSION")?.trim() ||
  Deno.env.get("META_GRAPH_API_VERSION")?.trim() ||
  "v23.0";
// The social stack has its own dedicated Meta app (TapThatFlyer Social). Only
// fall back to the project's legacy Meta app when the dedicated one is absent.
// Legacy Meta functions are untouched — they read their own secrets.
const hasDedicated = Boolean(
  Deno.env.get("SOCIAL_META_APP_ID")?.trim() && Deno.env.get("SOCIAL_META_APP_SECRET")?.trim(),
);
const SECRETS = hasDedicated
  ? ["SOCIAL_META_APP_ID", "SOCIAL_META_APP_SECRET"]
  : ["META_APP_ID", "META_APP_SECRET"];

/**
 * Facebook Login for Business configuration ID. When present, the authorization
 * dialog is driven by the saved configuration (which already carries the Page
 * permissions, including publishing) and we must NOT send a `scope` parameter.
 */
const FACEBOOK_CONFIG_ID = () => Deno.env.get("SOCIAL_FACEBOOK_CONFIG_ID")?.trim() || "";

function metaApp(): { appId: string; appSecret: string } | AdapterError {
  const env = requireEnv(SECRETS);
  if ("ok" in env && env.ok === false) return env as AdapterError;
  const e = env as Record<string, string>;
  return { appId: e[SECRETS[0]], appSecret: e[SECRETS[1]] };
}

/**
 * Fallback scopes used only when no Login for Business configuration is set.
 * `pages_manage_posts` is never requested directly in the scope parameter.
 */
export const FACEBOOK_SCOPES = (
  Deno.env.get("SOCIAL_FACEBOOK_SCOPES")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
    "pages_show_list",
    "pages_read_engagement",
  ]
);




/** Shared with the Instagram adapter: exchange the code for a long-lived user token. */
export async function exchangeFacebookCode(
  input: CallbackInput,
): Promise<AdapterResult<{ userToken: string; expiresAt: string | null }>> {
  const app = metaApp();
  if ("ok" in app && (app as AdapterError).ok === false) return app as AdapterError;
  const secrets = app as { appId: string; appSecret: string };

  const url = new URL(`https://graph.facebook.com/${GRAPH()}/oauth/access_token`);
  url.searchParams.set("client_id", secrets.appId);
  url.searchParams.set("client_secret", secrets.appSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code);
  const res = await fetchJson(url);
  if (!res.ok || typeof res.body.access_token !== "string") {
    return mapHttpError(res, "Facebook rejected the authorization code");
  }
  const shortToken = res.body.access_token;

  // Upgrade to a long-lived (~60 day) user token.
  const ll = new URL(`https://graph.facebook.com/${GRAPH()}/oauth/access_token`);
  ll.searchParams.set("grant_type", "fb_exchange_token");
  ll.searchParams.set("client_id", secrets.appId);
  ll.searchParams.set("client_secret", secrets.appSecret);
  ll.searchParams.set("fb_exchange_token", shortToken);
  const llRes = await fetchJson(ll);
  const longToken = typeof llRes.body.access_token === "string" ? llRes.body.access_token : shortToken;
  return {
    ok: true,
    userToken: longToken,
    expiresAt: expiresAtFrom(llRes.body.expires_in) ?? expiresAtFrom(res.body.expires_in),
  };
}

/** Shared with the Instagram adapter: list the Pages this user administers. */
export async function listFacebookPages(userToken: string) {
  const url = new URL(`https://graph.facebook.com/${GRAPH()}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,username,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", userToken);
  return await fetchJson(url);
}

function pagePicture(page: Record<string, unknown>): string | null {
  const pic = page.picture as { data?: { url?: string } } | undefined;
  return pic?.data?.url ?? null;
}

export const facebookAdapter: SocialPlatformAdapter = {
  platform: "facebook",
  requiredSecrets: SECRETS,
  defaultScopes: FACEBOOK_SCOPES,
  approvalNotes:
    "Facebook connects through the Meta Facebook Login for Business configuration (SOCIAL_FACEBOOK_CONFIG_ID); Page permissions, including publishing, come from that configuration rather than the OAuth scope parameter.",
  developerConsoleUrl: "https://developers.facebook.com/apps",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const app = metaApp();
    if ("ok" in app && (app as AdapterError).ok === false) return app as AdapterError;
    const configId = FACEBOOK_CONFIG_ID();
    const url = new URL(`https://www.facebook.com/${GRAPH()}/dialog/oauth`);
    url.searchParams.set("client_id", (app as { appId: string }).appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    if (configId) {
      // Login for Business: the saved configuration defines the permissions.
      url.searchParams.set("config_id", configId);
} else {
      url.searchParams.set(
        "scope",
        scopes.filter((s) => s !== "pages_manage_posts").join(","),
      );
    }
    return { ok: true, authorize_url: url.toString() };
  },


  async handleCallback(input) {
    const exchanged = await exchangeFacebookCode(input);
    if (exchanged.ok === false) return exchanged;

    const pages = await listFacebookPages(exchanged.userToken);
    if (!pages.ok) return mapHttpError(pages, "Could not list your Facebook Pages");
    const data = Array.isArray(pages.body.data) ? pages.body.data as Record<string, unknown>[] : [];
    if (!data.length) {
      return adapterError(
        "permission_missing",
        "No Facebook Pages were returned. Grant the app access to at least one Page you manage.",
      );
    }
    const accounts: ResolvedAccount[] = data
      .filter((p) => typeof p.access_token === "string")
      .map((p) => ({
        platform_account_id: String(p.id),
        account_name: typeof p.name === "string" ? p.name : null,
        username: typeof p.username === "string" ? p.username : null,
        profile_image_url: pagePicture(p),
        access_token: String(p.access_token),
        refresh_token: exchanged.userToken,
        token_expires_at: exchanged.expiresAt,
        scopes: FACEBOOK_SCOPES,
        metadata: { page_id: String(p.id) },
      }));
    return { ok: true, accounts };
  },

  /** Page tokens are re-derived from the stored long-lived user token. */
  async refreshToken(account) {
    if (!account.refresh_token) {
      return adapterError("auth_expired", "Reconnect Facebook to refresh this Page's access.");
    }
    const pages = await listFacebookPages(account.refresh_token);
    if (!pages.ok) return mapHttpError(pages, "Facebook re-authorization required");
    const data = Array.isArray(pages.body.data) ? pages.body.data as Record<string, unknown>[] : [];
    const match = data.find((p) => String(p.id) === account.platform_account_id);
    if (!match || typeof match.access_token !== "string") {
      return adapterError("permission_missing", "This Page is no longer granted to the app.");
    }
    return { ok: true, access_token: match.access_token, refresh_token: account.refresh_token };
  },

  async getAccount(account) {
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${account.platform_account_id}`);
    url.searchParams.set("fields", "id,name,username,picture{url},fan_count");
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url);
    if (!res.ok) return mapHttpError(res, "Could not read the Facebook Page");
    return {
      ok: true,
      account: {
        account_name: typeof res.body.name === "string" ? res.body.name : null,
        username: typeof res.body.username === "string" ? res.body.username : null,
        profile_image_url: pagePicture(res.body),
        metadata: { fan_count: res.body.fan_count ?? null },
      },
    };
  },

  /** Facebook accepts hosted URLs directly — no separate upload step is needed. */
  uploadMedia(_account: AdapterAccount, item: MediaItem) {
    return Promise.resolve({ ok: true as const, remote_media_id: item.url });
  },

  publishPost(account, input) {
    return postToPage(account, input, null);
  },

  schedulePost(account, input) {
    if (!input.scheduledAt) {
      return Promise.resolve(adapterError("validation", "A scheduled time is required."));
    }
    const unix = Math.floor(new Date(input.scheduledAt).getTime() / 1000);
    const min = Math.floor(Date.now() / 1000) + 600;
    if (unix < min) {
      return Promise.resolve(
        adapterError("validation", "Facebook requires scheduled posts to be at least 10 minutes out."),
      );
    }
    return postToPage(account, input, unix);
  },

  async deletePost(account, remotePostId) {
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${remotePostId}`);
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url, { method: "DELETE" });
    if (!res.ok) return mapHttpError(res, "Could not delete the Facebook post");
    return { ok: true };
  },

  async getPostStatus(account, remotePostId) {
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${remotePostId}`);
    url.searchParams.set("fields", "id,permalink_url,is_published,scheduled_publish_time");
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url);
    if (!res.ok) return mapHttpError(res, "Could not read the Facebook post");
    return {
      ok: true,
      status: res.body.is_published === false ? "scheduled" : "published",
      remote_post_url: typeof res.body.permalink_url === "string" ? res.body.permalink_url : null,
    };
  },

  async getAnalytics(account, remotePostId) {
    const snapshot: AnalyticsSnapshot = emptyAnalytics();
    const insights = new URL(`https://graph.facebook.com/${GRAPH()}/${remotePostId}/insights`);
    insights.searchParams.set(
      "metric",
      "post_impressions,post_impressions_unique,post_clicks,post_engaged_users,post_video_views",
    );
    insights.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(insights);
    if (!res.ok) return mapHttpError(res, "Facebook insights are unavailable for this post");
    const rows = Array.isArray(res.body.data) ? res.body.data as Record<string, unknown>[] : [];
    const raw: Record<string, unknown> = {};
    for (const row of rows) {
      const name = String(row.name || "");
      const values = Array.isArray(row.values) ? row.values as Record<string, unknown>[] : [];
      const value = Number(values[0]?.value ?? NaN);
      if (!Number.isFinite(value)) continue;
      raw[name] = value;
      if (name === "post_impressions") snapshot.impressions = value;
      if (name === "post_impressions_unique") snapshot.reach = value;
      if (name === "post_clicks") snapshot.clicks = value;
      if (name === "post_engaged_users") snapshot.engagements = value;
      if (name === "post_video_views") snapshot.video_views = value;
    }

    const counts = new URL(`https://graph.facebook.com/${GRAPH()}/${remotePostId}`);
    counts.searchParams.set(
      "fields",
      "likes.summary(true).limit(0),comments.summary(true).limit(0),shares",
    );
    counts.searchParams.set("access_token", account.access_token);
    const cRes = await fetchJson(counts);
    if (cRes.ok) {
      const likes = (cRes.body.likes as { summary?: { total_count?: number } })?.summary?.total_count;
      const comments = (cRes.body.comments as { summary?: { total_count?: number } })?.summary
        ?.total_count;
      const shares = (cRes.body.shares as { count?: number })?.count;
      snapshot.likes = typeof likes === "number" ? likes : null;
      snapshot.comments = typeof comments === "number" ? comments : null;
      snapshot.shares = typeof shares === "number" ? shares : null;
    }
    snapshot.platform_metrics = raw;
    return { ok: true, ...snapshot };
  },

  async revoke(account) {
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${account.platform_account_id}/permissions`);
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url, { method: "DELETE" });
    if (!res.ok) return mapHttpError(res, "Facebook could not revoke the permission grant");
    return { ok: true };
  },
};

async function postToPage(
  account: AdapterAccount,
  input: PublishInput,
  scheduledUnix: number | null,
): Promise<AdapterResult<PublishSuccess>> {
  const message = composeText(input.caption, input.hashtags, null);
  const video = input.media.find((m) => m.type === "video");
  const images = input.media.filter((m) => m.type === "image");
  const pageId = account.platform_account_id;
  const params = new URLSearchParams({ access_token: account.access_token });
  if (scheduledUnix) {
    params.set("published", "false");
    params.set("scheduled_publish_time", String(scheduledUnix));
  }

  let endpoint: string;
  if (video) {
    endpoint = `https://graph-video.facebook.com/${GRAPH()}/${pageId}/videos`;
    params.set("file_url", video.url);
    params.set("description", message);
  } else if (input.link) {
    // Link posts must go to /feed so the preview card stays clickable.
    endpoint = `https://graph.facebook.com/${GRAPH()}/${pageId}/feed`;
    params.set("message", message);
    params.set("link", input.link);
  } else if (images.length === 1) {
    endpoint = `https://graph.facebook.com/${GRAPH()}/${pageId}/photos`;
    params.set("url", images[0].url);
    params.set("caption", message);
  } else if (images.length > 1) {
    const ids: string[] = [];
    for (const image of images.slice(0, 10)) {
      const up = new URLSearchParams({
        access_token: account.access_token,
        url: image.url,
        published: "false",
      });
      const res = await fetchJson(`https://graph.facebook.com/${GRAPH()}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: up.toString(),
      });
      if (!res.ok || typeof res.body.id !== "string") {
        return mapHttpError(res, "Facebook rejected one of the images");
      }
      ids.push(res.body.id);
    }
    endpoint = `https://graph.facebook.com/${GRAPH()}/${pageId}/feed`;
    params.set("message", message);
    ids.forEach((id, i) => params.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  } else if (message) {
    endpoint = `https://graph.facebook.com/${GRAPH()}/${pageId}/feed`;
    params.set("message", message);
  } else {
    return adapterError("validation", "Nothing to post.");
  }

  const res = await fetchJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const id = typeof res.body.id === "string"
    ? res.body.id
    : typeof res.body.post_id === "string"
    ? res.body.post_id
    : null;
  if (!res.ok || !id) return mapHttpError(res, "Facebook rejected the post");
  return {
    ok: true,
    remote_post_id: id,
    remote_post_url: `https://www.facebook.com/${id.replace("_", "/posts/")}`,
    native_scheduled: Boolean(scheduledUnix),
  };
}
