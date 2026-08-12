import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export type ResolvedMetaCredentials = {
  pageId: string;
  pageAccessToken: string;
  source: "oauth" | "test_fallback";
  connectionId: string | null;
  /** The user whose Meta connection was actually used. */
  userId: string;
};

function tokenLast4(token: string) {
  return token.slice(-4);
}

export { tokenLast4 };

/**
 * Picks the user whose Meta connection should be used: prefer the acting
 * (logged-in) user's live OAuth connection, then fall back to the content owner.
 */
export async function resolveMetaUserId(
  supabase: SupabaseClient,
  ownerId: string,
  actorId?: string | null,
): Promise<string> {
  const candidates = [actorId, ownerId].filter(
    (id, i, arr): id is string => !!id && arr.indexOf(id) === i,
  );
  const withPage: string[] = [];
  // Pass 1: a connection that has BOTH a page and a stored OAuth token wins.
  for (const id of candidates) {
    const { data } = await supabase
      .from("meta_connections")
      .select("id, facebook_page_id")
      .eq("user_id", id)
      .eq("provider", "meta")
      .maybeSingle();
    if (!data?.facebook_page_id) continue;
    withPage.push(id);
    const { data: secret } = await supabase
      .from("meta_connection_secrets")
      .select("page_access_token")
      .eq("user_id", id)
      .maybeSingle();
    if (typeof secret?.page_access_token === "string" && secret.page_access_token.trim()) {
      return id;
    }
  }
  // Pass 2: any connected page (test-mode fallback path).
  if (withPage.length) return withPage[0];
  return ownerId;
}

/** True when a Graph error means the token/session is dead and needs re-auth. */
export function isSessionInvalidError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("session has been invalidated") ||
    m.includes("session has expired") ||
    m.includes("session is invalid") ||
    m.includes("access token") && (m.includes("expired") || m.includes("invalid")) ||
    m.includes("error validating access token") ||
    m.includes("malformed access token") ||
    m.includes("no longer available on this account") ||
    m.includes("connection expired")
  );
}

/**
 * Wipe stored Meta secrets and flag the connection as needing a reconnect so the
 * UI stops reporting "Connected with ...".
 */
export async function clearMetaConnection(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
) {
  try {
    await supabase.from("meta_connection_secrets").delete().eq("user_id", userId);
    await supabase
      .from("meta_connections")
      .update({
        status: "error",
        page_access_token_last4: null,
        last_error: (reason || "Reconnect required").slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "meta");
  } catch (err) {
    console.error("[metaCredentials] clearMetaConnection failed", err);
  }
}

const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION")?.trim() || "v21.0";

/**
 * Exchange the stored user access token for a fresh Page access token.
 * Page tokens can be invalidated independently of the user token, so we always
 * re-derive them from /me/accounts when a user token is available.
 */
async function freshPageTokenFromUserToken(
  userAccessToken: string,
  pageId: string,
): Promise<{ token: string } | { error: string }> {
  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
    url.searchParams.set("fields", "id,name,access_token");
    url.searchParams.set("limit", "200");
    url.searchParams.set("access_token", userAccessToken);
    const res = await fetch(url.toString());
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const msg = (json.error as Record<string, unknown> | undefined)?.message;
      return { error: String(msg || "Facebook session expired") };
    }
    const pages = Array.isArray(json.data) ? json.data as Record<string, unknown>[] : [];
    const match = pages.find((p) => String(p.id) === pageId) ?? null;
    const token = typeof match?.access_token === "string" ? match.access_token.trim() : "";
    if (!token) {
      return { error: "That Facebook Page is no longer available on this account." };
    }
    return { token };
  } catch (err) {
    return { error: String(err) };
  }
}

/** Prefer per-user OAuth page token; fall back to global test-mode token. */
export async function resolveMetaPageCredentials(
  supabase: SupabaseClient,
  ownerId: string,
  actorId?: string | null,
): Promise<ResolvedMetaCredentials | { error: string }> {
  const userId = await resolveMetaUserId(supabase, ownerId, actorId);

  const { data: connection, error: connErr } = await supabase
    .from("meta_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "meta")
    .maybeSingle();

  if (connErr) return { error: connErr.message };

  const { data: secretRow } = await supabase
    .from("meta_connection_secrets")
    .select("page_access_token, user_access_token")
    .eq("user_id", userId)
    .maybeSingle();

  const oauthToken = typeof secretRow?.page_access_token === "string"
    ? secretRow.page_access_token.trim()
    : "";
  const userToken = typeof secretRow?.user_access_token === "string"
    ? secretRow.user_access_token.trim()
    : "";
  const isOauthMode = String(connection?.connection_mode ?? "").toLowerCase() === "oauth";
  const pageId = connection?.facebook_page_id ? String(connection.facebook_page_id) : "";

  // 1. With a user token, always re-derive a fresh page token and persist it.
  if (pageId && userToken) {
    const fresh = await freshPageTokenFromUserToken(userToken, pageId);
    if ("token" in fresh) {
      if (fresh.token !== oauthToken) {
        await upsertMetaPageSecret(supabase, userId, fresh.token).catch(() => {});
      }
      return {
        pageId,
        pageAccessToken: fresh.token,
        source: "oauth",
        connectionId: connection?.id ? String(connection.id) : null,
        userId,
      };
    }
    // User token is dead: never silently fall back in OAuth mode.
    if (isOauthMode || !oauthToken) {
      await clearMetaConnection(supabase, userId, fresh.error);
      return {
        error:
          `Your Facebook connection expired (${fresh.error}). Click "Connect with Facebook" again to reauthorize posting.`,
      };
    }
  }

  if (oauthToken && pageId) {
    return {
      pageId,
      pageAccessToken: oauthToken,
      source: "oauth",
      connectionId: connection?.id ? String(connection.id) : null,
      userId,
    };
  }

  // 3. OAuth connections must never use the staff/global test token.
  if (isOauthMode) {
    await clearMetaConnection(supabase, userId, "Reconnect required");
    return {
      error:
        'Your Facebook connection needs to be reauthorized. Click "Connect with Facebook" again.',
    };
  }

  const testMode = (Deno.env.get("META_TEST_MODE_ENABLED") ?? "").toLowerCase() === "true";
  const globalToken = Deno.env.get("META_PAGE_ACCESS_TOKEN")?.trim() || "";

  if (testMode && globalToken && pageId) {
    return {
      pageId,
      pageAccessToken: globalToken,
      source: "test_fallback",
      connectionId: connection?.id ? String(connection.id) : null,
      userId,
    };
  }

  if (!pageId) {
    return { error: "Facebook page is not connected yet. Use Connect with Facebook or save a test page." };
  }
  if (!oauthToken && !testMode) {
    return { error: "Connect with Facebook to authorize posting for this account." };
  }
  if (!oauthToken && testMode && !globalToken) {
    return { error: "Missing META_PAGE_ACCESS_TOKEN for test-mode fallback." };
  }

  return { error: "Facebook page is not connected yet" };
}

export async function upsertMetaPageSecret(
  supabase: SupabaseClient,
  userId: string,
  pageAccessToken: string,
  userAccessToken?: string | null,
) {
  const row: Record<string, unknown> = {
    user_id: userId,
    page_access_token: pageAccessToken,
    updated_at: new Date().toISOString(),
  };
  if (typeof userAccessToken === "string" && userAccessToken.trim()) {
    row.user_access_token = userAccessToken.trim();
  }
  const { error } = await supabase
    .from("meta_connection_secrets")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
