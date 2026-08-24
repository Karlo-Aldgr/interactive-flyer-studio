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
import { expiresAtFrom, fetchJson, mapHttpError, requireEnv } from "../http.ts";

const SECRETS = ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"];
const SCOPES = ["openid", "profile", "email", "w_member_social"];

function authorUrn(account: AdapterAccount) {
  const org = account.metadata?.organization_urn;
  if (typeof org === "string" && org) return org;
  return `urn:li:person:${account.platform_account_id}`;
}

async function registerImage(
  account: AdapterAccount,
  item: MediaItem,
): Promise<AdapterResult<{ remote_media_id: string }>> {
  const register = await fetchJson("https://api.linkedin.com/v2/assets?action=registerUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: authorUrn(account),
        serviceRelationships: [{
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent",
        }],
      },
    }),
  });
  if (!register.ok) return mapHttpError(register, "LinkedIn refused the media upload registration");
  const value = register.body.value as Record<string, unknown> | undefined;
  const asset = typeof value?.asset === "string" ? value.asset : "";
  const mechanism = (value?.uploadMechanism ?? {}) as Record<string, Record<string, unknown>>;
  const uploadUrl = mechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]
    ?.uploadUrl as string | undefined;
  if (!asset || !uploadUrl) {
    return adapterError("unknown", "LinkedIn did not return an upload URL.");
  }

  const file = await fetch(item.url);
  if (!file.ok) return adapterError("validation", "The image URL could not be downloaded.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${account.access_token}` },
    body: bytes,
  });
  if (!put.ok) {
    return adapterError("transient", `LinkedIn media upload failed (HTTP ${put.status})`);
  }
  return { ok: true, remote_media_id: asset };
}

export const linkedinAdapter: SocialPlatformAdapter = {
  platform: "linkedin",
  requiredSecrets: SECRETS,
  defaultScopes: SCOPES,
  approvalNotes:
    "LinkedIn app needs the 'Sign In with LinkedIn using OpenID Connect' and 'Share on LinkedIn' products approved. Organization posting additionally requires 'Community Management API' access.",
  developerConsoleUrl: "https://www.linkedin.com/developers/apps",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", (env as Record<string, string>).LINKEDIN_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", scopes.join(" "));
    return { ok: true, authorize_url: url.toString() };
  },

  async handleCallback(input) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as Record<string, string>;
    const res = await fetchJson("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: secrets.LINKEDIN_CLIENT_ID,
        client_secret: secrets.LINKEDIN_CLIENT_SECRET,
      }).toString(),
    });
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "LinkedIn rejected the authorization code");
    }
    const token = res.body.access_token;
    const me = await fetchJson("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!me.ok || typeof me.body.sub !== "string") {
      return mapHttpError(me, "LinkedIn did not return a member profile");
    }
    const accounts: ResolvedAccount[] = [{
      platform_account_id: me.body.sub,
      account_name: typeof me.body.name === "string" ? me.body.name : null,
      username: typeof me.body.email === "string" ? me.body.email : null,
      profile_image_url: typeof me.body.picture === "string" ? me.body.picture : null,
      access_token: token,
      refresh_token: typeof res.body.refresh_token === "string" ? res.body.refresh_token : null,
      token_expires_at: expiresAtFrom(res.body.expires_in),
      scopes: SCOPES,
      metadata: { author_type: "member" },
    }];
    return { ok: true, accounts };
  },

  async refreshToken(account) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    if (!account.refresh_token) {
      return adapterError(
        "auth_expired",
        "LinkedIn access tokens last 60 days and refresh tokens are only issued to approved apps — reconnect LinkedIn.",
      );
    }
    const secrets = env as Record<string, string>;
    const res = await fetchJson("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
        client_id: secrets.LINKEDIN_CLIENT_ID,
        client_secret: secrets.LINKEDIN_CLIENT_SECRET,
      }).toString(),
    });
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "LinkedIn refresh failed");
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
    const me = await fetchJson("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    if (!me.ok) return mapHttpError(me, "Could not read the LinkedIn profile");
    return {
      ok: true,
      account: {
        account_name: typeof me.body.name === "string" ? me.body.name : null,
        profile_image_url: typeof me.body.picture === "string" ? me.body.picture : null,
      },
    };
  },

  uploadMedia(account, item) {
    if (item.type !== "image") {
      return Promise.resolve(
        adapterError("unsupported", "This adapter uploads images only; LinkedIn video needs Vector asset APIs."),
      );
    }
    return registerImage(account, item);
  },

  async publishPost(account, input: PublishInput): Promise<AdapterResult<PublishSuccess>> {
    const text = composeText(input.caption, input.hashtags, input.link);
    if (!text.trim()) return adapterError("validation", "LinkedIn posts need text.");
    if (input.media.some((m) => m.type === "video")) {
      return adapterError(
        "unsupported",
        "LinkedIn video publishing is not enabled in this adapter. Post an image or text update instead.",
      );
    }

    const images = input.media.filter((m) => m.type === "image").slice(0, 9);
    const assets: string[] = [];
    for (const image of images) {
      const uploaded = await registerImage(account, image);
      if (uploaded.ok === false) return uploaded;
      assets.push(uploaded.remote_media_id);
    }

    const shareContent: Record<string, unknown> = {
      shareCommentary: { text },
      shareMediaCategory: assets.length ? "IMAGE" : input.link ? "ARTICLE" : "NONE",
    };
    if (assets.length) {
      shareContent.media = assets.map((asset) => ({ status: "READY", media: asset }));
    } else if (input.link) {
      shareContent.media = [{ status: "READY", originalUrl: input.link }];
    }

    const res = await fetchJson("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: authorUrn(account),
        lifecycleState: "PUBLISHED",
        specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const id = typeof res.body.id === "string" ? res.body.id : null;
    if (!res.ok || !id) return mapHttpError(res, "LinkedIn rejected the post");
    return {
      ok: true,
      remote_post_id: id,
      remote_post_url: `https://www.linkedin.com/feed/update/${id}`,
      native_scheduled: false,
    };
  },

  schedulePost() {
    return Promise.resolve(
      adapterError("unsupported", "LinkedIn has no scheduling API — TapThatFlyer queues the post instead."),
    );
  },

  async deletePost(account, remotePostId) {
    const res = await fetchJson(
      `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(remotePostId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      },
    );
    if (!res.ok && res.status !== 204) return mapHttpError(res, "LinkedIn could not delete the post");
    return { ok: true };
  },

  getPostStatus(_account, remotePostId) {
    return Promise.resolve({
      ok: true as const,
      status: "published",
      remote_post_url: `https://www.linkedin.com/feed/update/${remotePostId}`,
    });
  },

  getAnalytics() {
    return Promise.resolve({
      ok: true as const,
      ...emptyAnalytics({
        note: "LinkedIn share statistics require Community Management API access, which this app has not been granted.",
      }),
    });
  },

  revoke() {
    return Promise.resolve({ ok: true as const });
  },
};
