import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { maskKey, tiktokCredentials, tiktokEnvName } from "../_shared/tiktokEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const creds = tiktokCredentials();
    if ("missing" in creds) {
      return json({ error: `TikTok is not configured: missing ${creds.missing.join(", ")}` }, 400);
    }
    const clientKey = creds.clientKey;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const returnTo = typeof body.return_to === "string" ? body.return_to : "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const state = crypto.randomUUID().replace(/-/g, "");
    const { error: stateErr } = await supabase.from("tiktok_oauth_states").insert({
      state,
      user_id: user.id,
      return_to: returnTo || null,
    });
    if (stateErr) return json({ error: stateErr.message }, 500);

    const redirectUri = Deno.env.get("TIKTOK_REDIRECT_URI")?.trim().replace(/\/$/, "") ||
      "https://tapthatflyer.com/auth/tiktok/callback";
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    console.log(
      `[tiktok-oauth-start] env=${tiktokEnvName()} client_key=${maskKey(clientKey)} redirect_uri=${redirectUri}`,
    );
    return json({
      ok: true,
      url: authUrl.toString(),
      env: tiktokEnvName(),
      client_key_masked: maskKey(clientKey),
      redirect_uri: redirectUri,
    });
  } catch (err) {
    console.error("[tiktok-oauth-start]", err);
    return json({ error: String(err) }, 500);
  }
});
