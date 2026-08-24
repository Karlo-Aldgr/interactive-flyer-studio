// Instagram Business Login (Instagram API with Instagram Login).
// This adapter talks ONLY to the Instagram endpoints (www.instagram.com /
// api.instagram.com / graph.instagram.com) using its own dedicated app
// credentials. The legacy Facebook-Page based Meta integration is untouched.
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
  type ResolvedAccount,
  type SocialPlatformAdapter,
} from "../types.ts";
import { fetchJson, mapHttpError, requireEnv } from "../http.ts";

const GRAPH = () =>
  Deno.env.get("SOCIAL_INSTAGRAM_GRAPH_API_VERSION")?.trim() ||
  Deno.env.get("SOCIAL_META_GRAPH_API_VERSION")?.trim() ||
  "v23.0";

const IG_HOST = "https://graph.instagram.com";
const SECRETS = ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"];

const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
];

function creds() {
  const env = requireEnv(SECRETS);
  return env;
}

/** Instagram appends `#_` to the returned code in browser redirects. */
function cleanCode(code: string) {
  return code.replace(/#_$/, "").trim();
}

function expiryFromSeconds(seconds: unknown): string | null {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 1000).toISOString();
}

async function waitForContainer(
  containerId: string,
  token: string,
): Promise<AdapterResult<Record<string, never>>> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const url = new URL(`${IG_HOST}/${GRAPH()}/${containerId}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", token);
    const res = await fetchJson(url);
    const code = String(res.body.status_code || "");
    if (code === "FINISHED") return { ok: true };
    if (code === "ERROR" || code === "EXPIRED") {
      return adapterError("validation", String(res.body.status || "Instagram could not process the media"));
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return adapterError("transient", "Instagram is still processing the media. Try again shortly.");
}

export const instagramAdapter: SocialPlatformAdapter = {
  platform: "instagram",
  requiredSecrets: SECRETS,
  defaultScopes: IG_SCOPES,
  approvalNotes:
    "Uses Instagram Business Login. The customer needs an Instagram professional (Business or Creator) account and simply logs in with Instagram — no Facebook Page setup required.",
  developerConsoleUrl: "https://developers.facebook.com/apps",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const env = creds();
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", (env as Record<string, string>).INSTAGRAM_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", (scopes.length ? scopes : IG_SCOPES).join(","));
    url.searchParams.set("state", state);
    return { ok: true, authorize_url: url.toString() };
  },

  async handleCallback(input) {
    const env = creds();
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET } = env as Record<string, string>;

    // 1. Authorization code -> short-lived Instagram user token.
    const tokenRes = await fetchJson("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
        code: cleanCode(input.code),
      }).toString(),
    });
    if (!tokenRes.ok || typeof tokenRes.body.access_token !== "string") {
      return mapHttpError(tokenRes, "Instagram did not accept the login. Please try connecting again.");
    }
    let accessToken = tokenRes.body.access_token as string;
    let expiresAt: string | null = null;

    // 2. Short-lived -> long-lived (~60 days) token.
    const longUrl = new URL(`${IG_HOST}/access_token`);
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", INSTAGRAM_APP_SECRET);
    longUrl.searchParams.set("access_token", accessToken);
    const longRes = await fetchJson(longUrl);
    if (longRes.ok && typeof longRes.body.access_token === "string") {
      accessToken = longRes.body.access_token;
      expiresAt = expiryFromSeconds(longRes.body.expires_in);
    }

    // 3. Identify the authorized professional account.
    const meUrl = new URL(`${IG_HOST}/${GRAPH()}/me`);
    meUrl.searchParams.set(
      "fields",
      "user_id,username,name,profile_picture_url,account_type,followers_count",
    );
    meUrl.searchParams.set("access_token", accessToken);
    const me = await fetchJson(meUrl);
    if (!me.ok) return mapHttpError(me, "Could not read the Instagram account");

    const igId = String(me.body.user_id ?? me.body.id ?? "");
    if (!igId) {
      return adapterError(
        "permission_missing",
        "That Instagram account is not a professional (Business or Creator) account. Switch it in the Instagram app and reconnect.",
      );
    }

    const account: ResolvedAccount = {
      platform_account_id: igId,
      account_name: typeof me.body.name === "string" ? me.body.name : null,
      username: typeof me.body.username === "string" ? me.body.username : null,
      profile_image_url: typeof me.body.profile_picture_url === "string"
        ? me.body.profile_picture_url
        : null,
      access_token: accessToken,
      refresh_token: accessToken,
      token_expires_at: expiresAt,
      scopes: IG_SCOPES,
      metadata: {
        login_type: "instagram_business_login",
        account_type: me.body.account_type ?? null,
        followers_count: me.body.followers_count ?? null,
      },
    };
    return { ok: true, accounts: [account] };
  },

  async refreshToken(account) {
    const url = new URL(`${IG_HOST}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url);
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "Reconnect Instagram to keep posting.");
    }
    return {
      ok: true,
      access_token: res.body.access_token,
      refresh_token: res.body.access_token,
      token_expires_at: expiryFromSeconds(res.body.expires_in),
    };
  },

  async getAccount(account) {
    const url = new URL(`${IG_HOST}/${GRAPH()}/me`);
    url.searchParams.set(
      "fields",
      "user_id,username,name,profile_picture_url,account_type,followers_count",
    );
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url);
    if (!res.ok) return mapHttpError(res, "Could not read the Instagram account");
    return {
      ok: true,
      account: {
        account_name: typeof res.body.name === "string" ? res.body.name : null,
        username: typeof res.body.username === "string" ? res.body.username : null,
        profile_image_url: typeof res.body.profile_picture_url === "string"
          ? res.body.profile_picture_url
          : null,
        metadata: {
          login_type: "instagram_business_login",
          account_type: res.body.account_type ?? null,
          followers_count: res.body.followers_count ?? null,
        },
      },
    };
  },

  uploadMedia(_account: AdapterAccount, item: MediaItem) {
    return Promise.resolve({ ok: true as const, remote_media_id: item.url });
  },

  async publishPost(account, input: PublishInput): Promise<AdapterResult<PublishSuccess>> {
    const media = input.media;
    if (!media.length) {
      return adapterError("validation", "Instagram requires at least one image or video.");
    }
    const caption = composeText(input.caption, input.hashtags, input.link);
    const igId = account.platform_account_id;
    const token = account.access_token;
    const base = `${IG_HOST}/${GRAPH()}/${igId}/media`;

    const createContainer = async (item: MediaItem, carouselChild: boolean) => {
      const params = new URLSearchParams({ access_token: token });
      if (item.type === "video") {
        params.set("media_type", "REELS");
        params.set("video_url", item.url);
      } else {
        params.set("image_url", item.url);
      }
      if (carouselChild) params.set("is_carousel_item", "true");
      else params.set("caption", caption);
      return await fetchJson(base, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
    };

    let creationId: string;
    if (media.length === 1) {
      const res = await createContainer(media[0], false);
      if (!res.ok || typeof res.body.id !== "string") {
        return mapHttpError(res, "Instagram rejected the media");
      }
      creationId = res.body.id;
    } else {
      const children: string[] = [];
      for (const item of media.slice(0, 10)) {
        const res = await createContainer(item, true);
        if (!res.ok || typeof res.body.id !== "string") {
          return mapHttpError(res, "Instagram rejected one of the carousel items");
        }
        children.push(res.body.id);
      }
      const params = new URLSearchParams({
        access_token: token,
        media_type: "CAROUSEL",
        caption,
        children: children.join(","),
      });
      const res = await fetchJson(base, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!res.ok || typeof res.body.id !== "string") {
        return mapHttpError(res, "Instagram rejected the carousel");
      }
      creationId = res.body.id;
    }

    const ready = await waitForContainer(creationId, token);
    if (ready.ok === false) return ready;

    const publish = await fetchJson(
      `${IG_HOST}/${GRAPH()}/${igId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: token, creation_id: creationId }).toString(),
      },
    );
    if (!publish.ok || typeof publish.body.id !== "string") {
      return mapHttpError(publish, "Instagram rejected the publish request");
    }
    return {
      ok: true,
      remote_post_id: publish.body.id,
      remote_post_url: null,
      native_scheduled: false,
    };
  },

  schedulePost() {
    return Promise.resolve(
      adapterError(
        "unsupported",
        "Instagram has no native scheduling API — TapThatFlyer queues the post and publishes it at the scheduled time.",
      ),
    );
  },

  deletePost() {
    return Promise.resolve(
      adapterError("unsupported", "The Instagram API cannot delete published media."),
    );
  },

  async getPostStatus(account, remotePostId) {
    const url = new URL(`${IG_HOST}/${GRAPH()}/${remotePostId}`);
    url.searchParams.set("fields", "id,permalink,media_type");
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url);
    if (!res.ok) return mapHttpError(res, "Could not read the Instagram media");
    return {
      ok: true,
      status: "published",
      remote_post_url: typeof res.body.permalink === "string" ? res.body.permalink : null,
    };
  },

  async getAnalytics(account, remotePostId) {
    const url = new URL(`${IG_HOST}/${GRAPH()}/${remotePostId}/insights`);
    url.searchParams.set("metric", "reach,likes,comments,shares,saved,total_interactions,views");
    url.searchParams.set("access_token", account.access_token);
    const res = await fetchJson(url);
    if (!res.ok) return mapHttpError(res, "Instagram insights are unavailable for this media");
    const snapshot = emptyAnalytics();
    const raw: Record<string, unknown> = {};
    const rows = Array.isArray(res.body.data) ? res.body.data as Record<string, unknown>[] : [];
    for (const row of rows) {
      const name = String(row.name || "");
      const values = Array.isArray(row.values) ? row.values as Record<string, unknown>[] : [];
      const value = Number(values[0]?.value ?? NaN);
      if (!Number.isFinite(value)) continue;
      raw[name] = value;
      if (name === "views") snapshot.impressions = value;
      if (name === "reach") snapshot.reach = value;
      if (name === "likes") snapshot.likes = value;
      if (name === "comments") snapshot.comments = value;
      if (name === "shares") snapshot.shares = value;
      if (name === "total_interactions") snapshot.engagements = value;
    }
    snapshot.platform_metrics = raw;
    return { ok: true, ...snapshot };
  },

  revoke() {
    return Promise.resolve({ ok: true as const });
  },
};
