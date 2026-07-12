import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { tokenLast4 } from "../_shared/metaCredentials.ts";

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

function pickIg(data: Record<string, unknown>) {
  const igBiz = data.instagram_business_account as Record<string, unknown> | undefined;
  const igConnected = data.connected_instagram_account as Record<string, unknown> | undefined;
  const ig = igBiz?.id ? igBiz : (igConnected?.id ? igConnected : undefined);
  if (!ig?.id) return null;
  return {
    instagram_user_id: String(ig.id),
    instagram_username: typeof ig.username === "string" ? ig.username : null,
  };
}

async function resolveInstagramAccount(args: {
  pageId: string;
  accessToken: string;
  graphVersion: string;
}) {
  const url = new URL(`https://graph.facebook.com/${args.graphVersion}/${args.pageId}`);
  url.searchParams.set(
    "fields",
    "instagram_business_account{id,username},connected_instagram_account{id,username}",
  );
  url.searchParams.set("access_token", args.accessToken);

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const message = data.error && typeof data.error === "object"
      ? String((data.error as Record<string, unknown>).message || "Could not resolve Instagram account")
      : "Could not resolve Instagram account";
    return { error: message };
  }

  const ig = pickIg(data);
  if (!ig) {
    return { error: "No Instagram Business/Creator account is linked to this Facebook Page" };
  }
  return ig;
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

    if ((Deno.env.get("META_TEST_MODE_ENABLED") ?? "").toLowerCase() !== "true") {
      return json({ error: "Meta test mode is not enabled yet. Add META_TEST_MODE_ENABLED=true in Supabase secrets first." }, 400);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const facebookPageId = typeof body.facebook_page_id === "string" ? body.facebook_page_id.trim() : "";
    const facebookPageName = typeof body.facebook_page_name === "string" ? body.facebook_page_name.trim() : "";
    if (!facebookPageId || !facebookPageName) {
      return json({ error: "Missing Facebook page details" }, 400);
    }

    const metaAppId = Deno.env.get("META_APP_ID")?.trim() || null;
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    const globalToken = Deno.env.get("META_PAGE_ACCESS_TOKEN")?.trim() || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("meta_connections")
      .select("id, connection_mode")
      .eq("user_id", user.id)
      .eq("provider", "meta")
      .maybeSingle();

    const { data: secretRow } = await supabase
      .from("meta_connection_secrets")
      .select("page_access_token, user_access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const oauthPageToken = typeof secretRow?.page_access_token === "string"
      ? secretRow.page_access_token.trim()
      : "";
    const oauthUserToken = typeof secretRow?.user_access_token === "string"
      ? secretRow.user_access_token.trim()
      : "";

    // Meta often requires a User token (not Page token) to read IG on Business Manager pages.
    const tokenCandidates: Array<{ token: string; source: string }> = [];
    if (oauthUserToken) tokenCandidates.push({ token: oauthUserToken, source: "oauth_user" });
    if (oauthPageToken) tokenCandidates.push({ token: oauthPageToken, source: "oauth_page" });
    if (globalToken) tokenCandidates.push({ token: globalToken, source: "test_fallback" });

    const preserveOauth = existing?.connection_mode === "oauth" || !!oauthPageToken || !!oauthUserToken;

    let instagramUserId: string | null = null;
    let instagramUsername: string | null = null;
    let lastError: string | null = null;
    let tokenSource = "none";
    let pageAccessTokenForLast4 = oauthPageToken || globalToken;

    if (!tokenCandidates.length) {
      lastError = "No page access token available. Use Connect with Facebook first.";
    } else {
      for (const candidate of tokenCandidates) {
        const ig = await resolveInstagramAccount({
          pageId: facebookPageId,
          accessToken: candidate.token,
          graphVersion,
        });
        tokenSource = candidate.source;
        if (!("error" in ig)) {
          instagramUserId = ig.instagram_user_id;
          instagramUsername = ig.instagram_username;
          lastError = null;
          break;
        }
        lastError = `${ig.error} (token: ${candidate.source})`;
      }
    }

    const status = (pageAccessTokenForLast4 || oauthUserToken)
      ? (instagramUserId ? "ready" : "connected")
      : "connected";

    const row = {
      user_id: user.id,
      provider: "meta",
      meta_app_id: metaAppId,
      connection_mode: preserveOauth ? "oauth" : "manual_test",
      status,
      facebook_page_id: facebookPageId,
      facebook_page_name: facebookPageName,
      instagram_user_id: instagramUserId,
      instagram_username: instagramUsername,
      page_access_token_last4: pageAccessTokenForLast4 ? tokenLast4(pageAccessTokenForLast4) : null,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("meta_connections")
      .upsert(row, { onConflict: "user_id,provider" })
      .select("*")
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, connection: data, token_source: tokenSource });
  } catch (err) {
    console.error("[meta-connect-start]", err);
    return json({ error: String(err) }, 500);
  }
});
