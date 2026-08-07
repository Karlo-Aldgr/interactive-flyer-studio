import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

/** Resolve a usable TikTok access token, refreshing it when expired. */
export async function resolveTikTokAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string } | { error: string }> {
  const { data: row, error } = await supabase
    .from("tiktok_connection_secrets")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row?.access_token) {
    return { error: "TikTok is not connected for this account." };
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at as string).getTime() : 0;
  const stillValid = !expiresAt || expiresAt - Date.now() > 60_000;
  if (stillValid) return { accessToken: String(row.access_token) };

  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")?.trim();
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET")?.trim();
  const refreshToken = typeof row.refresh_token === "string" ? row.refresh_token : "";
  if (!clientKey || !clientSecret || !refreshToken) {
    return { error: "TikTok token expired. Reconnect TikTok in TapThatFlyer." };
  }

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!res.ok || !accessToken) {
    return { error: "TikTok token refresh failed. Reconnect TikTok in TapThatFlyer." };
  }

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 86_400;
  await supabase.from("tiktok_connection_secrets").upsert({
    user_id: userId,
    access_token: accessToken,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : refreshToken,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return { accessToken };
}
