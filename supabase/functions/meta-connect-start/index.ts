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

async function resolveInstagramAccount(pageId: string, pageAccessToken: string, graphVersion: string) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${pageId}`);
  url.searchParams.set("fields", "instagram_business_account{id,username}");
  url.searchParams.set("access_token", pageAccessToken);

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const message = data.error && typeof data.error === "object"
      ? String((data.error as Record<string, unknown>).message || "Could not resolve Instagram account")
      : "Could not resolve Instagram account";
    return { error: message };
  }

  const ig = data.instagram_business_account as Record<string, unknown> | undefined;
  if (!ig?.id) {
    return { error: "No Instagram Business/Creator account is linked to this Facebook Page" };
  }

  return {
    instagram_user_id: String(ig.id),
    instagram_username: typeof ig.username === "string" ? ig.username : null,
  };
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
      .select("page_access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const oauthToken = typeof secretRow?.page_access_token === "string"
      ? secretRow.page_access_token.trim()
      : "";

    // Prefer the user's OAuth page token (matches Connect with Facebook).
    // Global test token is fallback only — it often cannot see Instagram.
    const pageAccessToken = oauthToken || globalToken;
    const tokenSource = oauthToken ? "oauth" : (globalToken ? "test_fallback" : "none");
    const preserveOauth = existing?.connection_mode === "oauth" || !!oauthToken;

    let instagramUserId: string | null = null;
    let instagramUsername: string | null = null;
    let lastError: string | null = null;
    let status = pageAccessToken ? "ready" : "connected";

    if (pageAccessToken) {
      const ig = await resolveInstagramAccount(facebookPageId, pageAccessToken, graphVersion);
      if ("error" in ig && ig.error) {
        lastError = `${ig.error} (token: ${tokenSource})`;
        status = "connected";
      } else {
        instagramUserId = ig.instagram_user_id ?? null;
        instagramUsername = ig.instagram_username ?? null;
      }
    } else {
      lastError = "No page access token available. Use Connect with Facebook first.";
    }

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
      page_access_token_last4: pageAccessToken ? tokenLast4(pageAccessToken) : null,
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
