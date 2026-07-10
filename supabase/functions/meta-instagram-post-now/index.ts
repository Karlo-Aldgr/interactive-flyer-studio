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

    if ((Deno.env.get("META_TEST_MODE_ENABLED") ?? "").toLowerCase() !== "true") {
      return json({ error: "Meta test mode is not enabled yet. Add META_TEST_MODE_ENABLED=true in Supabase secrets first." }, 400);
    }

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

    const { data: connection, error: connErr } = await supabase
      .from("meta_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "meta")
      .maybeSingle();
    if (connErr) return json({ error: connErr.message }, 500);
    if (!connection?.facebook_page_id) {
      return json({ error: "Facebook page is not connected yet" }, 400);
    }

    const pageAccessToken = Deno.env.get("META_PAGE_ACCESS_TOKEN")?.trim();
    if (!pageAccessToken) {
      return json({ error: "Missing META_PAGE_ACCESS_TOKEN secret" }, 400);
    }

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    let igUserId = typeof connection.instagram_user_id === "string" ? connection.instagram_user_id : "";
    let igUsername = typeof connection.instagram_username === "string" ? connection.instagram_username : null;

    if (!igUserId) {
      const lookupUrl = new URL(`https://graph.facebook.com/${graphVersion}/${connection.facebook_page_id}`);
      lookupUrl.searchParams.set("fields", "instagram_business_account{id,username}");
      lookupUrl.searchParams.set("access_token", pageAccessToken);
      const lookupRes = await fetch(lookupUrl.toString());
      const lookupJson = await lookupRes.json().catch(() => ({})) as Record<string, unknown>;
      const ig = lookupJson.instagram_business_account as Record<string, unknown> | undefined;
      if (!lookupRes.ok || !ig?.id) {
        const message = providerErrorMessage(
          lookupJson,
          "No Instagram Business/Creator account is linked to this Facebook Page",
        );
        return json({ error: message }, 400);
      }
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

    const createParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: pageAccessToken,
    });
    const createRes = await fetch(`https://graph.facebook.com/${graphVersion}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: createParams.toString(),
    });
    const createJson = await createRes.json().catch(() => ({})) as Record<string, unknown>;
    if (!createRes.ok || typeof createJson.id !== "string") {
      const message = providerErrorMessage(createJson, "Instagram media create failed");
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
        page_access_token_last4: pageAccessToken.slice(-4),
      }).eq("id", connection.id);
      return json({ error: message }, 502);
    }

    const publishParams = new URLSearchParams({
      creation_id: createJson.id,
      access_token: pageAccessToken,
    });
    const publishRes = await fetch(`https://graph.facebook.com/${graphVersion}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishParams.toString(),
    });
    const publishJson = await publishRes.json().catch(() => ({})) as Record<string, unknown>;
    if (!publishRes.ok || typeof publishJson.id !== "string") {
      const message = providerErrorMessage(publishJson, "Instagram media publish failed");
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
        page_access_token_last4: pageAccessToken.slice(-4),
      }).eq("id", connection.id);
      return json({ error: message }, 502);
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
        page_access_token_last4: pageAccessToken.slice(-4),
      })
      .eq("id", connection.id);

    return json({ ok: true, provider_post_id: publishJson.id, draft: updatedDraft });
  } catch (err) {
    console.error("[meta-instagram-post-now]", err);
    return json({ error: String(err) }, 500);
  }
});
