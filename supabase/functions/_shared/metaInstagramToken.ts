/**
 * Exchange / refresh Instagram Login user tokens (60-day long-lived).
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export type StoredInstagramToken = {
  accessToken: string;
  expiresAt: string | null;
  userId: string | null;
  source: "db" | "env";
};

function providerErrorMessage(payload: Record<string, unknown>, fallback: string) {
  if (payload.error && typeof payload.error === "object") {
    return String((payload.error as Record<string, unknown>).message || fallback).slice(0, 500);
  }
  if (typeof payload.error_message === "string") return payload.error_message.slice(0, 500);
  return String(payload.error || fallback).slice(0, 500);
}

/** Short-lived → long-lived (needs Instagram App Secret, not Facebook App Secret). */
export async function exchangeInstagramShortLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | { error: string }> {
  const clientSecret = Deno.env.get("META_INSTAGRAM_APP_SECRET")?.trim()
    || Deno.env.get("META_APP_SECRET")?.trim()
    || "";
  if (!clientSecret) {
    return {
      error:
        "Missing META_INSTAGRAM_APP_SECRET (Instagram app secret from Meta → API setup with Instagram login).",
    };
  }

  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedToken.trim());

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string") {
    return { error: providerErrorMessage(data, "Could not exchange Instagram token for long-lived token") };
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 60 * 24 * 60 * 60;
  return { accessToken: data.access_token, expiresIn };
}

/** Refresh a still-valid long-lived token (must be ≥24h old and not expired). */
export async function refreshInstagramLongLivedToken(longLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | { error: string }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken.trim());

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string") {
    return { error: providerErrorMessage(data, "Could not refresh Instagram long-lived token") };
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 60 * 24 * 60 * 60;
  return { accessToken: data.access_token, expiresIn };
}

export function expiresAtFromSeconds(expiresIn: number): string {
  return new Date(Date.now() + Math.max(0, expiresIn) * 1000).toISOString();
}

export async function upsertInstagramUserToken(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  expiresAt: string | null,
) {
  const { data: existing } = await supabase
    .from("meta_connection_secrets")
    .select("page_access_token")
    .eq("user_id", userId)
    .maybeSingle();

  const pageToken = typeof existing?.page_access_token === "string" ? existing.page_access_token : "";
  if (!pageToken) {
    // page_access_token is NOT NULL — keep a placeholder if somehow missing (OAuth should have set it).
    const { error } = await supabase.from("meta_connection_secrets").upsert({
      user_id: userId,
      page_access_token: pageToken || "pending",
      instagram_user_access_token: accessToken,
      instagram_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("meta_connection_secrets")
    .update({
      instagram_user_access_token: accessToken,
      instagram_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Prefer DB long-lived token for this user (or any staff row with IG token), then env fallback.
 * Auto-refreshes when expiry is within `refreshIfWithinDays` (default 7).
 */
export async function resolveStoredInstagramToken(
  supabase: SupabaseClient,
  preferredUserId?: string | null,
  refreshIfWithinDays = 7,
): Promise<StoredInstagramToken | { error: string }> {
  let row: {
    user_id: string;
    instagram_user_access_token: string | null;
    instagram_token_expires_at: string | null;
  } | null = null;

  if (preferredUserId) {
    const { data } = await supabase
      .from("meta_connection_secrets")
      .select("user_id, instagram_user_access_token, instagram_token_expires_at")
      .eq("user_id", preferredUserId)
      .maybeSingle();
    if (data?.instagram_user_access_token) row = data as typeof row;
  }

  if (!row?.instagram_user_access_token) {
    const { data } = await supabase
      .from("meta_connection_secrets")
      .select("user_id, instagram_user_access_token, instagram_token_expires_at")
      .not("instagram_user_access_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.instagram_user_access_token) row = data as typeof row;
  }

  let accessToken = row?.instagram_user_access_token?.trim() || "";
  let expiresAt = row?.instagram_token_expires_at || null;
  let userId = row?.user_id || preferredUserId || null;
  let source: "db" | "env" = "db";

  if (!accessToken) {
    accessToken = Deno.env.get("META_INSTAGRAM_USER_ACCESS_TOKEN")?.trim() || "";
    source = "env";
    userId = preferredUserId || null;
  }

  if (!accessToken) {
    return {
      error:
        "No Instagram user token. Run Extend Instagram token (or set META_INSTAGRAM_USER_ACCESS_TOKEN).",
    };
  }

  const shouldRefresh = (() => {
    if (!expiresAt) return source === "env"; // try extend/refresh env token once into DB when possible
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    return msLeft <= refreshIfWithinDays * 24 * 60 * 60 * 1000;
  })();

  if (shouldRefresh) {
    // Prefer refresh (long-lived). If that fails, try short→long exchange.
    let next = await refreshInstagramLongLivedToken(accessToken);
    if ("error" in next) {
      next = await exchangeInstagramShortLivedToken(accessToken);
    }
    if (!("error" in next)) {
      accessToken = next.accessToken;
      expiresAt = expiresAtFromSeconds(next.expiresIn);
      if (userId) {
        try {
          await upsertInstagramUserToken(supabase, userId, accessToken, expiresAt);
          source = "db";
        } catch (err) {
          console.warn("[instagram-token] could not persist refreshed token", err);
        }
      }
    } else if (source === "env" && !expiresAt) {
      // Keep using env token; refresh may fail if already long-lived but Meta rejected for other reasons.
      console.warn("[instagram-token] refresh/exchange skipped:", next.error);
    } else if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return { error: next.error };
    }
  }

  return { accessToken, expiresAt, userId, source };
}
