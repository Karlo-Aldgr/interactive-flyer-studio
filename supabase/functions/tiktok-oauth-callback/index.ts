import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { tiktokCredentials } from "../_shared/tiktokEnv.ts";

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const fallback = Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://tapthatflyer.com";

  try {
    if (!code || !state) return redirect(`${fallback}/dashboard?tiktok=error`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow } = await supabase
      .from("tiktok_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow || new Date(stateRow.expires_at as string).getTime() < Date.now()) {
      return redirect(`${fallback}/dashboard?tiktok=expired`);
    }
    await supabase.from("tiktok_oauth_states").delete().eq("state", state);

    const creds = tiktokCredentials();
    if ("missing" in creds) {
      console.error("[tiktok-oauth-callback] missing secrets", creds.missing.join(", "));
      return redirect(`${fallback}/dashboard?tiktok=misconfigured`);
    }
    const { clientKey, clientSecret } = creds;

    // Must byte-match the redirect_uri used by tiktok-oauth-start.
    const redirectUri = Deno.env.get("TIKTOK_REDIRECT_URI")?.trim().replace(/\/$/, "") ||
      "https://tapthatflyer.com/auth/tiktok/callback";
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    const tokenJson = await tokenRes.json().catch(() => ({})) as Record<string, unknown>;
    const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
    if (!tokenRes.ok || !accessToken) {
      console.error("[tiktok-oauth-callback] token exchange failed", tokenRes.status);
      return redirect(`${fallback}/dashboard?tiktok=token_error`);
    }

    const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 86_400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await supabase.from("tiktok_connection_secrets").upsert({
      user_id: stateRow.user_id,
      access_token: accessToken,
      refresh_token: typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    let username: string | null = null;
    const infoRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const infoJson = await infoRes.json().catch(() => ({})) as Record<string, unknown>;
    const infoUser = (infoJson.data as Record<string, unknown> | undefined)?.user as
      | Record<string, unknown>
      | undefined;
    if (infoUser) {
      username = typeof infoUser.username === "string"
        ? infoUser.username
        : (typeof infoUser.display_name === "string" ? infoUser.display_name : null);
    }

    await supabase.from("tiktok_connections").upsert({
      user_id: stateRow.user_id,
      open_id: typeof tokenJson.open_id === "string" ? tokenJson.open_id : null,
      username,
      status: "connected",
      last_error: null,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    const returnTo = typeof stateRow.return_to === "string" && stateRow.return_to
      ? stateRow.return_to
      : `${fallback}/dashboard`;
    return redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}tiktok=connected`);
  } catch (err) {
    console.error("[tiktok-oauth-callback]", err);
    return redirect(`${fallback}/dashboard?tiktok=error`);
  }
});
