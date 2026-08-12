/**
 * Facebook OAuth callback — exchanges code, stores page token, redirects to app.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { tokenLast4, upsertMetaPageSecret } from "../_shared/metaCredentials.ts";

function html(message: string, status = 200) {
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
      <p>${message}</p>
      <p><a href="/">Return to TapThatFlyer</a></p>
    </body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function redirect(url: string) {
  return Response.redirect(url, 302);
}

async function exchangeCodeForUserToken(args: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
  graphVersion: string;
}) {
  const url = new URL(`https://graph.facebook.com/${args.graphVersion}/oauth/access_token`);
  url.searchParams.set("client_id", args.appId);
  url.searchParams.set("client_secret", args.appSecret);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("code", args.code);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string") {
    const msg = data.error && typeof data.error === "object"
      ? String((data.error as Record<string, unknown>).message || "Token exchange failed")
      : "Token exchange failed";
    throw new Error(msg);
  }
  return data.access_token;
}

async function extendUserToken(args: {
  shortToken: string;
  appId: string;
  appSecret: string;
  graphVersion: string;
}) {
  const url = new URL(`https://graph.facebook.com/${args.graphVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", args.appId);
  url.searchParams.set("client_secret", args.appSecret);
  url.searchParams.set("fb_exchange_token", args.shortToken);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string") {
    // Fall back to short-lived token if extend fails.
    return args.shortToken;
  }
  return data.access_token;
}

const PAGE_FIELDS =
  "id,name,access_token,instagram_business_account{id,username},connected_instagram_account{id,username}";

async function listPagesFromEdge(userToken: string, graphVersion: string, edge: string) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${edge}`);
  url.searchParams.set("fields", PAGE_FIELDS);
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", userToken);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const msg = data.error && typeof data.error === "object"
      ? String((data.error as Record<string, unknown>).message || `Could not list pages via ${edge}`)
      : `Could not list pages via ${edge}`;
    console.warn(`[meta-oauth-callback] ${edge} failed: ${msg}`);
    return [] as Array<Record<string, unknown>>;
  }
  return Array.isArray(data.data) ? data.data as Array<Record<string, unknown>> : [];
}

/** Last resort: read granted Page IDs from debug_token, then fetch each Page token. */
async function listPagesFromDebugToken(args: {
  userToken: string;
  graphVersion: string;
  appId: string;
  appSecret: string;
}) {
  const dbg = new URL(`https://graph.facebook.com/${args.graphVersion}/debug_token`);
  dbg.searchParams.set("input_token", args.userToken);
  dbg.searchParams.set("access_token", `${args.appId}|${args.appSecret}`);
  const res = await fetch(dbg.toString());
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) return [] as Array<Record<string, unknown>>;
  const info = (data.data || {}) as Record<string, unknown>;
  const granular = Array.isArray(info.granular_scopes)
    ? info.granular_scopes as Array<Record<string, unknown>>
    : [];
  const ids = new Set<string>();
  for (const g of granular) {
    const targets = Array.isArray(g.target_ids) ? g.target_ids : [];
    for (const t of targets) if (t) ids.add(String(t));
  }
  const pages: Array<Record<string, unknown>> = [];
  for (const id of ids) {
    const url = new URL(`https://graph.facebook.com/${args.graphVersion}/${id}`);
    url.searchParams.set("fields", PAGE_FIELDS);
    url.searchParams.set("access_token", args.userToken);
    const pr = await fetch(url.toString());
    const pd = await pr.json().catch(() => ({})) as Record<string, unknown>;
    if (pr.ok && typeof pd.access_token === "string") pages.push(pd);
  }
  return pages;
}

async function resolvePageFromUserToken(args: {
  userToken: string;
  graphVersion: string;
  preferredPageId?: string | null;
  appId: string;
  appSecret: string;
}) {
  let pages = await listPagesFromEdge(args.userToken, args.graphVersion, "me/accounts");
  if (!pages.length) {
    pages = await listPagesFromEdge(args.userToken, args.graphVersion, "me/assigned_pages");
  }
  if (!pages.length) {
    pages = await listPagesFromDebugToken({
      userToken: args.userToken,
      graphVersion: args.graphVersion,
      appId: args.appId,
      appSecret: args.appSecret,
    });
  }
  if (!pages.length) {
    throw new Error(
      "No Facebook Pages were returned for this account. Make sure you selected your Page (and its Business) during the Facebook permission screen.",
    );
  }

  const preferred = args.preferredPageId
    ? pages.find((p) => String(p.id) === args.preferredPageId)
    : null;
  const withToken = pages.filter((p) => typeof p.access_token === "string");
  const page = (preferred && typeof preferred.access_token === "string")
    ? preferred
    : (withToken[0] || pages[0]);
  if (typeof page.access_token !== "string" || !page.id) {
    throw new Error("Page token missing from Meta response");
  }

  const igBiz = page.instagram_business_account as Record<string, unknown> | undefined;
  const igConnected = page.connected_instagram_account as Record<string, unknown> | undefined;
  const ig = igBiz?.id ? igBiz : (igConnected?.id ? igConnected : undefined);
  return {
    facebook_page_id: String(page.id),
    facebook_page_name: typeof page.name === "string" ? page.name : "Facebook Page",
    page_access_token: page.access_token,
    instagram_user_id: ig?.id ? String(ig.id) : null,
    instagram_username: typeof ig?.username === "string" ? ig.username : null,
  };
}

Deno.serve(async (req) => {
  try {
    const reqUrl = new URL(req.url);
    const code = reqUrl.searchParams.get("code") || "";
    const state = reqUrl.searchParams.get("state") || "";
    const oauthError = reqUrl.searchParams.get("error_description") || reqUrl.searchParams.get("error") || "";

    const successBase = (
      Deno.env.get("META_OAUTH_SUCCESS_URL")?.trim() ||
      Deno.env.get("APP_ORIGIN")?.trim() ||
      "https://tapthatflyer.com"
    ).replace(/\/$/, "");

    if (oauthError) {
      return redirect(`${successBase}/dashboard?meta_oauth=error&reason=${encodeURIComponent(oauthError.slice(0, 200))}`);
    }
    if (!code || !state) return html("Missing OAuth code or state.", 400);

    const appId = Deno.env.get("META_APP_ID")?.trim();
    const appSecret = Deno.env.get("META_APP_SECRET")?.trim();
    if (!appId || !appSecret) return html("META_APP_ID / META_APP_SECRET not configured.", 500);

    const redirectUri = (
      Deno.env.get("META_OAUTH_REDIRECT_URI")?.trim() ||
      `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/meta-oauth-callback`
    );
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow, error: stateErr } = await supabase
      .from("meta_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    if (stateErr) return html(stateErr.message, 500);
    if (!stateRow) return html("Invalid or expired OAuth state. Start Connect with Facebook again.", 400);
    if (new Date(String(stateRow.expires_at)).getTime() < Date.now()) {
      await supabase.from("meta_oauth_states").delete().eq("state", state);
      return html("OAuth state expired. Start Connect with Facebook again.", 400);
    }

    const userId = String(stateRow.user_id);
    const returnTo = typeof stateRow.return_to === "string" && stateRow.return_to
      ? stateRow.return_to
      : `${successBase}/dashboard?meta_oauth=connected`;

    // One-time use
    await supabase.from("meta_oauth_states").delete().eq("state", state);

    const shortUserToken = await exchangeCodeForUserToken({
      code,
      redirectUri,
      appId,
      appSecret,
      graphVersion,
    });
    const longUserToken = await extendUserToken({
      shortToken: shortUserToken,
      appId,
      appSecret,
      graphVersion,
    });

    const { data: existing } = await supabase
      .from("meta_connections")
      .select("facebook_page_id")
      .eq("user_id", userId)
      .eq("provider", "meta")
      .maybeSingle();

    const page = await resolvePageFromUserToken({
      userToken: longUserToken,
      graphVersion,
      preferredPageId: existing?.facebook_page_id ? String(existing.facebook_page_id) : null,
    });

    await upsertMetaPageSecret(supabase, userId, page.page_access_token, longUserToken);

    const { error: upsertErr } = await supabase.from("meta_connections").upsert({
      user_id: userId,
      provider: "meta",
      meta_app_id: appId,
      connection_mode: "oauth",
      status: "ready",
      facebook_page_id: page.facebook_page_id,
      facebook_page_name: page.facebook_page_name,
      instagram_user_id: page.instagram_user_id,
      instagram_username: page.instagram_username,
      page_access_token_last4: tokenLast4(page.page_access_token),
      last_error: page.instagram_user_id
        ? null
        : "Instagram not returned by Meta yet. Paste Instagram User ID manually in Instagram Post Now, or reconnect after linking a Professional Instagram account.",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    if (upsertErr) return html(upsertErr.message, 500);

    const dest = new URL(returnTo, successBase);
    dest.searchParams.set("meta_oauth", "connected");
    dest.searchParams.set("page", page.facebook_page_name);
    return redirect(dest.toString());
  } catch (err) {
    console.error("[meta-oauth-callback]", err);
    const successBase = (
      Deno.env.get("META_OAUTH_SUCCESS_URL")?.trim() ||
      "https://tapthatflyer.com"
    ).replace(/\/$/, "");
    return redirect(
      `${successBase}/dashboard?meta_oauth=error&reason=${encodeURIComponent(String(err).slice(0, 200))}`,
    );
  }
});
