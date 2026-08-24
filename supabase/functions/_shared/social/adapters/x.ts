import {
  adapterError,
  type AdapterResult,
  type AuthStartInput,
  composeText,
  emptyAnalytics,
  type PublishInput,
  type PublishSuccess,
  type SocialPlatformAdapter,
} from "../types.ts";
import { expiresAtFrom, fetchJson, mapHttpError, requireEnv } from "../http.ts";

const SECRETS = ["X_CLIENT_ID", "X_CLIENT_SECRET"];
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

function basicAuth(id: string, secret: string) {
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

export const xAdapter: SocialPlatformAdapter = {
  platform: "x",
  requiredSecrets: SECRETS,
  defaultScopes: SCOPES,
  approvalNotes:
    "X developer app must be OAuth 2.0 with PKCE enabled and the callback URL registered. Posting media and reading post metrics require a paid X API tier.",
  developerConsoleUrl: "https://developer.x.com/en/portal/dashboard",

  startOAuth({ redirectUri, state, scopes }: AuthStartInput) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", (env as Record<string, string>).X_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    // The caller injects code_challenge (PKCE is mandatory for X).
    return { ok: true, authorize_url: url.toString(), code_verifier: "required" };
  },

  async handleCallback(input) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as Record<string, string>;
    if (!input.codeVerifier) {
      return adapterError("validation", "The PKCE verifier for this X connection is missing or expired.");
    }
    const res = await fetchJson("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth(secrets.X_CLIENT_ID, secrets.X_CLIENT_SECRET),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
        client_id: secrets.X_CLIENT_ID,
      }).toString(),
    });
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "X rejected the authorization code");
    }
    const token = res.body.access_token;
    const me = await fetchJson("https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = (me.body.data ?? {}) as Record<string, unknown>;
    if (!me.ok || typeof user.id !== "string") {
      return mapHttpError(me, "X did not return the authenticated user");
    }
    return {
      ok: true,
      accounts: [{
        platform_account_id: user.id,
        account_name: typeof user.name === "string" ? user.name : null,
        username: typeof user.username === "string" ? user.username : null,
        profile_image_url: typeof user.profile_image_url === "string" ? user.profile_image_url : null,
        access_token: token,
        refresh_token: typeof res.body.refresh_token === "string" ? res.body.refresh_token : null,
        token_expires_at: expiresAtFrom(res.body.expires_in),
        scopes: SCOPES,
        metadata: {},
      }],
    };
  },

  async refreshToken(account) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    if (!account.refresh_token) {
      return adapterError("auth_expired", "Reconnect X — no refresh token is stored (offline.access scope required).");
    }
    const secrets = env as Record<string, string>;
    const res = await fetchJson("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth(secrets.X_CLIENT_ID, secrets.X_CLIENT_SECRET),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
        client_id: secrets.X_CLIENT_ID,
      }).toString(),
    });
    if (!res.ok || typeof res.body.access_token !== "string") {
      return mapHttpError(res, "X refresh failed");
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
    const me = await fetchJson(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username,public_metrics",
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    if (!me.ok) return mapHttpError(me, "Could not read the X profile");
    const user = (me.body.data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      account: {
        account_name: typeof user.name === "string" ? user.name : null,
        username: typeof user.username === "string" ? user.username : null,
        profile_image_url: typeof user.profile_image_url === "string" ? user.profile_image_url : null,
        metadata: { public_metrics: user.public_metrics ?? null },
      },
    };
  },

  uploadMedia() {
    return Promise.resolve(
      adapterError(
        "unsupported",
        "Media upload on X requires the v1.1 media endpoints on a paid API tier. Text and link posts work today.",
      ),
    );
  },

  async publishPost(account, input: PublishInput): Promise<AdapterResult<PublishSuccess>> {
    if (input.media.length) {
      return adapterError(
        "unsupported",
        "This X connection can publish text and links only — media upload needs a paid X API tier.",
      );
    }
    const text = composeText(input.caption, input.hashtags, input.link);
    if (!text.trim()) return adapterError("validation", "An X post needs text.");
    if (text.length > 280) {
      return adapterError("validation", `X allows 280 characters — this post is ${text.length}.`);
    }
    const res = await fetchJson("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    const id = (res.body.data as { id?: string } | undefined)?.id;
    if (!res.ok || !id) return mapHttpError(res, "X rejected the post");
    return {
      ok: true,
      remote_post_id: id,
      remote_post_url: `https://x.com/${account.username ?? "i"}/status/${id}`,
      native_scheduled: false,
    };
  },

  schedulePost() {
    return Promise.resolve(
      adapterError("unsupported", "The X API has no scheduling endpoint — TapThatFlyer queues the post instead."),
    );
  },

  async deletePost(account, remotePostId) {
    const res = await fetchJson(`https://api.twitter.com/2/tweets/${remotePostId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    if (!res.ok) return mapHttpError(res, "X could not delete the post");
    return { ok: true };
  },

  getPostStatus(account, remotePostId) {
    return Promise.resolve({
      ok: true as const,
      status: "published",
      remote_post_url: `https://x.com/${account.username ?? "i"}/status/${remotePostId}`,
    });
  },

  getAnalytics() {
    return Promise.resolve({
      ok: true as const,
      ...emptyAnalytics({
        note: "Post metrics on X require organic metrics access on a paid API tier.",
      }),
    });
  },

  async revoke(account) {
    const env = requireEnv(SECRETS);
    if ("ok" in env && env.ok === false) return env as AdapterError;
    const secrets = env as Record<string, string>;
    const res = await fetchJson("https://api.twitter.com/2/oauth2/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuth(secrets.X_CLIENT_ID, secrets.X_CLIENT_SECRET),
      },
      body: new URLSearchParams({
        token: account.access_token,
        client_id: secrets.X_CLIENT_ID,
        token_type_hint: "access_token",
      }).toString(),
    });
    if (!res.ok) return mapHttpError(res, "X could not revoke the token");
    return { ok: true };
  },
};
