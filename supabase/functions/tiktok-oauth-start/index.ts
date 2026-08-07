import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

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

    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")?.trim();
    if (!clientKey) return json({ error: "TIKTOK_CLIENT_KEY is not configured" }, 400);

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

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tiktok-oauth-callback`;
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return json({ ok: true, url: authUrl.toString() });
  } catch (err) {
    console.error("[tiktok-oauth-start]", err);
    return json({ error: String(err) }, 500);
  }
});
