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
  for (const id of candidates) {
    const { data } = await supabase
      .from("meta_connections")
      .select("id, facebook_page_id")
      .eq("user_id", id)
      .eq("provider", "meta")
      .maybeSingle();
    if (data?.facebook_page_id) return id;
  }
  return ownerId;
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
    .select("page_access_token")
    .eq("user_id", userId)
    .maybeSingle();

  const oauthToken = typeof secretRow?.page_access_token === "string"
    ? secretRow.page_access_token.trim()
    : "";

  if (oauthToken && connection?.facebook_page_id) {
    return {
      pageId: String(connection.facebook_page_id),
      pageAccessToken: oauthToken,
      source: "oauth",
      connectionId: connection.id ? String(connection.id) : null,
      userId,
    };
  }


  const testMode = (Deno.env.get("META_TEST_MODE_ENABLED") ?? "").toLowerCase() === "true";
  const globalToken = Deno.env.get("META_PAGE_ACCESS_TOKEN")?.trim() || "";

  if (testMode && globalToken && connection?.facebook_page_id) {
    return {
      pageId: String(connection.facebook_page_id),
      pageAccessToken: globalToken,
      source: "test_fallback",
      connectionId: connection.id ? String(connection.id) : null,
      userId,

    };
  }

  if (!connection?.facebook_page_id) {
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
