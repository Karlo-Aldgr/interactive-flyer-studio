/**
 * Extend / refresh Instagram Login user token to a 60-day long-lived token and store it.
 * Auth: logged-in user JWT.
 *
 * Body (optional):
 * - access_token: short-lived or long-lived token (defaults to META_INSTAGRAM_USER_ACCESS_TOKEN)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  exchangeInstagramShortLivedToken,
  expiresAtFromSeconds,
  refreshInstagramLongLivedToken,
  upsertInstagramUserToken,
} from "../_shared/metaInstagramToken.ts";
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

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const provided = typeof body.access_token === "string" ? body.access_token.trim() : "";
    const seed = provided || Deno.env.get("META_INSTAGRAM_USER_ACCESS_TOKEN")?.trim() || "";
    if (!seed) {
      return json({
        error:
          "No Instagram token to extend. Generate token in Meta, set META_INSTAGRAM_USER_ACCESS_TOKEN, or pass access_token.",
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Prefer refresh (already long-lived). Fall back to short→long exchange.
    // If both fail (e.g. token <24h old long-lived), still persist the seed with a conservative expiry.
    let mode: "refreshed" | "exchanged" | "stored_as_is" = "refreshed";
    let accessToken = seed;
    let expiresIn = 55 * 24 * 60 * 60;

    const refreshed = await refreshInstagramLongLivedToken(seed);
    if (!("error" in refreshed)) {
      mode = "refreshed";
      accessToken = refreshed.accessToken;
      expiresIn = refreshed.expiresIn;
    } else {
      const exchanged = await exchangeInstagramShortLivedToken(seed);
      if (!("error" in exchanged)) {
        mode = "exchanged";
        accessToken = exchanged.accessToken;
        expiresIn = exchanged.expiresIn;
      } else {
        mode = "stored_as_is";
        console.warn("[meta-instagram-token-extend] refresh/exchange failed; storing seed", refreshed.error, exchanged.error);
      }
    }

    const expiresAt = expiresAtFromSeconds(expiresIn);
    await upsertInstagramUserToken(supabase, user.id, accessToken, expiresAt);

    await supabase
      .from("meta_connections")
      .update({
        status: "ready",
        last_error: null,
        page_access_token_last4: tokenLast4(accessToken),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("provider", "meta");

    const messages = {
      exchanged: "Short-lived token exchanged for a ~60-day Instagram token and saved.",
      refreshed: "Long-lived Instagram token refreshed for another ~60 days and saved.",
      stored_as_is:
        "Saved current Instagram token (Meta would not exchange/refresh yet). Try Extend again after 24 hours to refresh.",
    };

    return json({
      ok: true,
      mode,
      expires_at: expiresAt,
      expires_in_days: Math.round(expiresIn / 86400),
      token_last4: tokenLast4(accessToken),
      message: messages[mode],
    });
  } catch (err) {
    console.error("[meta-instagram-token-extend]", err);
    return json({ error: String(err) }, 500);
  }
});
