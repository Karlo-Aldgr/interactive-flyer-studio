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

async function canManageDraft(supabase: ReturnType<typeof createClient>, userId: string, ownerId: string) {
  if (userId === ownerId) return true;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: isEditor } = await supabase.rpc("has_role", { _user_id: userId, _role: "editor" });
  return !!isAdmin || !!isEditor;
}

function providerErrorMessage(payload: Record<string, unknown>, fallback: string) {
  if (payload.error && typeof payload.error === "object") {
    return String((payload.error as Record<string, unknown>).message || fallback).slice(0, 500);
  }
  return String(payload.error || fallback).slice(0, 500);
}

function isPublicHttpUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
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
    const draftId = typeof body.draft_id === "string" ? body.draft_id : "";
    const captionOverride = typeof body.caption === "string" ? body.caption.trim() : "";
    if (!draftId) return json({ error: "Missing draft_id" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: draft, error: draftErr } = await supabase
      .from("marketing_drafts")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();
    if (draftErr) return json({ error: draftErr.message }, 500);
    if (!draft) return json({ error: "Marketing draft not found" }, 404);

    const allowed = await canManageDraft(supabase, user.id, draft.owner_id as string);
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const { resolveMetaPageCredentials, tokenLast4 } = await import("../_shared/metaCredentials.ts");

    const { data: connection, error: connErr } = await supabase
      .from("meta_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "meta")
      .maybeSingle();
    if (connErr) return json({ error: connErr.message }, 500);
    if (!connection) {
      return json({ error: "Meta connection not found. Connect Facebook first, then save Instagram User ID." }, 400);
    }

    // Prefer Instagram Login user token (required for this app's Instagram Business use case).
    // Facebook Page OAuth tokens cannot request instagram_business_* scopes on facebook.com/dialog/oauth.
    const igLoginToken = Deno.env.get("META_INSTAGRAM_USER_ACCESS_TOKEN")?.trim() || "";
    let accessToken = igLoginToken;
    let apiHost = "graph.instagram.com";
    let tokenSource: "instagram_login" | "facebook_page" = "instagram_login";

    if (!accessToken) {
      const creds = await resolveMetaPageCredentials(supabase, user.id);
      if ("error" in creds) {
        return json({
          error:
            "Missing META_INSTAGRAM_USER_ACCESS_TOKEN. In Meta → API setup with Instagram login → Generate token for @carlojay.algordo, then add that token as the Lovable secret META_INSTAGRAM_USER_ACCESS_TOKEN.",
        }, 400);
      }
      accessToken = creds.pageAccessToken;
      apiHost = "graph.facebook.com";
      tokenSource = "facebook_page";
    }

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    let igUserId = typeof connection.instagram_user_id === "string" ? connection.instagram_user_id.trim() : "";
    let igUsername = typeof connection.instagram_username === "string" ? connection.instagram_username : null;

    if (!igUserId && tokenSource === "facebook_page") {
      const creds = await resolveMetaPageCredentials(supabase, user.id);
      if (!("error" in creds)) {
        const lookupUrl = new URL(`https://graph.facebook.com/${graphVersion}/${creds.pageId}`);
        lookupUrl.searchParams.set(
          "fields",
          "instagram_business_account{id,username},connected_instagram_account{id,username}",
        );
        lookupUrl.searchParams.set("access_token", accessToken);
        const lookupRes = await fetch(lookupUrl.toString());
        const lookupJson = await lookupRes.json().catch(() => ({})) as Record<string, unknown>;
        const igBiz = lookupJson.instagram_business_account as Record<string, unknown> | undefined;
        const igConnected = lookupJson.connected_instagram_account as Record<string, unknown> | undefined;
        const ig = igBiz?.id ? igBiz : (igConnected?.id ? igConnected : undefined);
        if (lookupRes.ok && ig?.id) {
          igUserId = String(ig.id);
          igUsername = typeof ig.username === "string" ? ig.username : null;
          await supabase
            .from("meta_connections")
            .update({
              instagram_user_id: igUserId,
              instagram_username: igUsername,
              last_error: null,
            })
            .eq("id", connection.id);
        }
      }
    }

    if (!igUserId) {
      return json({
        error: "Instagram User ID is missing. Paste the numeric ID from Meta → Generate access tokens (under @carlojay.algordo).",
      }, 400);
    }

    const caption = captionOverride || String(draft.instagram_caption || "").trim();
    if (!caption) return json({ error: "No Instagram caption is ready yet" }, 400);

    const imageUrl = String(draft.thumbnail_url || "").trim();
    if (!isPublicHttpUrl(imageUrl)) {
      return json({
        error: "Instagram needs a public flyer thumbnail URL. Publish/regenerate so thumbnail_url is publicly reachable (not a local LAN URL).",
      }, 400);
    }

    const attemptAt = new Date().toISOString();
    await supabase
      .from("marketing_drafts")
      .update({
        instagram_provider_status: "posting",
        instagram_last_attempt_at: attemptAt,
        instagram_last_error: null,
      })
      .eq("id", draftId);

    async function igPost(path: string, body: Record<string, string>) {
      const url = `https://${apiHost}/${graphVersion}/${path}`;
      if (tokenSource === "instagram_login") {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        return { res, data };
      }
      const params = new URLSearchParams({ ...body, access_token: accessToken });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { res, data };
    }

    async function igGet(path: string, fields?: string) {
      const url = new URL(`https://${apiHost}/${graphVersion}/${path}`);
      if (fields) url.searchParams.set("fields", fields);
      if (tokenSource === "instagram_login") {
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        return { res, data };
      }
      url.searchParams.set("access_token", accessToken);
      const res = await fetch(url.toString());
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { res, data };
    }

    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /** Instagram often needs the container FINISHED before media_publish, or returns "Media ID is not available". */
    async function waitForContainerReady(containerId: string) {
      let lastStatus = "UNKNOWN";
      for (let i = 0; i < 20; i++) {
        if (i > 0) await sleep(2500);
        const { res, data } = await igGet(containerId, "status_code,status");
        lastStatus = String(data.status_code || data.status || "UNKNOWN");
        if (!res.ok) {
          return { ok: false as const, status: lastStatus, error: providerErrorMessage(data, "Container status check failed") };
        }
        if (lastStatus === "FINISHED") return { ok: true as const, status: lastStatus };
        if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
          return {
            ok: false as const,
            status: lastStatus,
            error: providerErrorMessage(data, `Instagram media container ${lastStatus}. Check image is a public JPEG URL.`),
          };
        }
      }
      return {
        ok: false as const,
        status: lastStatus,
        error: `Instagram media container not ready (last status: ${lastStatus}). Try Post now again in a few seconds.`,
      };
    }

    async function markFailed(message: string) {
      await supabase.from("marketing_drafts").update({
        instagram_status: "failed",
        instagram_error_message: message,
        instagram_provider_status: "failed",
        instagram_last_attempt_at: attemptAt,
        instagram_last_error: message,
      }).eq("id", draftId);
      await supabase.from("meta_connections").update({
        status: "error",
        last_error: message,
        page_access_token_last4: tokenLast4(accessToken),
      }).eq("id", connection.id);
    }

    // Instagram Content Publishing only supports JPEG images.
    if (!/\.jpe?g(\?|#|$)/i.test(imageUrl) && !/image\/jpeg/i.test(imageUrl)) {
      console.warn("[meta-instagram-post-now] image URL may not be JPEG:", imageUrl);
    }

    const { res: createRes, data: createJson } = await igPost(`${igUserId}/media`, {
      image_url: imageUrl,
      caption,
    });
    if (!createRes.ok || typeof createJson.id !== "string") {
      const message = providerErrorMessage(createJson, "Instagram media create failed");
      await markFailed(message);
      return json({ error: message, image_url: imageUrl }, 502);
    }

    const ready = await waitForContainerReady(createJson.id);
    if (!ready.ok) {
      await markFailed(ready.error);
      return json({ error: ready.error, container_id: createJson.id, status: ready.status }, 502);
    }

    let publishJson: Record<string, unknown> = {};
    let publishRes: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(2000);
      const result = await igPost(`${igUserId}/media_publish`, {
        creation_id: createJson.id,
      });
      publishRes = result.res;
      publishJson = result.data;
      if (publishRes.ok && typeof publishJson.id === "string") break;
      const msg = providerErrorMessage(publishJson, "");
      // Retry briefly when Meta hasn't finished wiring the media ID yet.
      if (!/media id is not available/i.test(msg)) break;
    }

    if (!publishRes?.ok || typeof publishJson.id !== "string") {
      const message = providerErrorMessage(publishJson, "Instagram media publish failed");
      await markFailed(message);
      return json({ error: message, container_id: createJson.id }, 502);
    }

    const successPatch = {
      instagram_status: "posted",
      instagram_posted_at: attemptAt,
      instagram_scheduled_for: null,
      instagram_error_message: null,
      instagram_provider_status: "posted",
      instagram_provider_post_id: publishJson.id,
      instagram_last_attempt_at: attemptAt,
      instagram_last_error: null,
    };

    const { data: updatedDraft, error: updateErr } = await supabase
      .from("marketing_drafts")
      .update(successPatch)
      .eq("id", draftId)
      .select("*")
      .single();
    if (updateErr) return json({ error: updateErr.message }, 500);

    await supabase
      .from("meta_connections")
      .update({
        status: "ready",
        last_error: null,
        instagram_user_id: igUserId,
        instagram_username: igUsername,
        page_access_token_last4: tokenLast4(accessToken),
      })
      .eq("id", connection.id);

    return json({
      ok: true,
      provider_post_id: publishJson.id,
      draft: updatedDraft,
      token_source: tokenSource,
    });
  } catch (err) {
    console.error("[meta-instagram-post-now]", err);
    return json({ error: String(err) }, 500);
  }
});
