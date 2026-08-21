import {
  adapterError,
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
import { exchangeFacebookCode, listFacebookPages } from "./facebook.ts";

const GRAPH = () =>
  Deno.env.get("SOCIAL_META_GRAPH_API_VERSION")?.trim() ||
  Deno.env.get("META_GRAPH_API_VERSION")?.trim() ||
  "v23.0";
const SECRETS = ["SOCIAL_META_APP_ID", "SOCIAL_META_APP_SECRET"];

const IG_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
];

async function waitForContainer(
  containerId: string,
  token: string,
): Promise<AdapterResult<Record<string, never>>> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${containerId}`);
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
    "Requires an Instagram Business/Creator account linked to a Facebook Page, plus advanced access to instagram_basic, instagram_content_publish and instagram_manage_insights.",
  developerConsoleUrl: "https://developers.facebook.com/apps",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env;
    const url = new URL(`https://www.facebook.com/${GRAPH()}/dialog/oauth`);
    url.searchParams.set("client_id", (env as Record<string, string>).SOCIAL_META_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    return { ok: true, authorize_url: url.toString() };
  },

  async handleCallback(input) {
    const exchanged = await exchangeFacebookCode(input);
    if (exchanged.ok === false) return exchanged;
    const pages = await listFacebookPages(exchanged.userToken);
    if (!pages.ok) return mapHttpError(pages, "Could not list your Facebook Pages");
    const data = Array.isArray(pages.body.data) ? pages.body.data as Record<string, unknown>[] : [];

    const accounts: ResolvedAccount[] = [];
    for (const page of data) {
      const ig = page.instagram_business_account as Record<string, unknown> | undefined;
      if (!ig?.id || typeof page.access_token !== "string") continue;
      accounts.push({
        platform_account_id: String(ig.id),
        account_name: typeof ig.name === "string" ? ig.name : (page.name as string) ?? null,
        username: typeof ig.username === "string" ? ig.username : null,
        profile_image_url: typeof ig.profile_picture_url === "string" ? ig.profile_picture_url : null,
        access_token: page.access_token,
        refresh_token: exchanged.userToken,
        token_expires_at: exchanged.expiresAt,
        scopes: IG_SCOPES,
        metadata: { page_id: String(page.id), page_name: page.name ?? null },
      });
    }
    if (!accounts.length) {
      return adapterError(
        "permission_missing",
        "No Instagram Business account is linked to your Facebook Pages. Link one in Facebook Page settings and reconnect.",
      );
    }
    return { ok: true, accounts };
  },

  async refreshToken(account) {
    if (!account.refresh_token) {
      return adapterError("auth_expired", "Reconnect Instagram to refresh access.");
    }
    const pages = await listFacebookPages(account.refresh_token);
    if (!pages.ok) return mapHttpError(pages, "Instagram re-authorization required");
    const data = Array.isArray(pages.body.data) ? pages.body.data as Record<string, unknown>[] : [];
    const match = data.find((p) => {
      const ig = p.instagram_business_account as Record<string, unknown> | undefined;
      return ig?.id && String(ig.id) === account.platform_account_id;
    });
    if (!match || typeof match.access_token !== "string") {
      return adapterError("permission_missing", "This Instagram account is no longer granted to the app.");
    }
    return { ok: true, access_token: match.access_token, refresh_token: account.refresh_token };
  },

  async getAccount(account) {
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${account.platform_account_id}`);
    url.searchParams.set("fields", "id,username,name,profile_picture_url,followers_count");
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
        metadata: { followers_count: res.body.followers_count ?? null },
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
    const base = `https://graph.facebook.com/${GRAPH()}/${igId}/media`;

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
      `https://graph.facebook.com/${GRAPH()}/${igId}/media_publish`,
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
      adapterError("unsupported", "The Instagram Graph API cannot delete published media."),
    );
  },

  async getPostStatus(account, remotePostId) {
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${remotePostId}`);
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
    const url = new URL(`https://graph.facebook.com/${GRAPH()}/${remotePostId}/insights`);
    url.searchParams.set("metric", "impressions,reach,likes,comments,shares,saved,total_interactions");
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
      if (name === "impressions") snapshot.impressions = value;
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
