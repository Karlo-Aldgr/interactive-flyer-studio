/**
 * Start Facebook Login (Pages) OAuth for the logged-in TapThatFlyer user.
 */
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

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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

    const appId = Deno.env.get("META_APP_ID")?.trim();
    if (!appId) return json({ error: "META_APP_ID is not configured" }, 500);

    const redirectUri = (
      Deno.env.get("META_OAUTH_REDIRECT_URI")?.trim() ||
      `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/meta-oauth-callback`
    );

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const returnTo = typeof body.return_to === "string" ? body.return_to.trim().slice(0, 500) : "";

    const state = randomState();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: stateErr } = await supabase.from("meta_oauth_states").insert({
      state,
      user_id: user.id,
      return_to: returnTo || null,
      expires_at: expiresAt,
    });
    if (stateErr) return json({ error: stateErr.message }, 500);

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    const scope = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
    ].join(",");

    const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", scope);
    url.searchParams.set("response_type", "code");

    return json({
      ok: true,
      authorize_url: url.toString(),
      redirect_uri: redirectUri,
    });
  } catch (err) {
    console.error("[meta-oauth-start]", err);
    return json({ error: String(err) }, 500);
  }
});
