import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  instagramFailurePatch,
  instagramSuccessPatch,
  postInstagramImage,
  resolveInstagramAccess,
} from "../_shared/metaInstagramPost.ts";
import { resolveMetaPageCredentials, tokenLast4 } from "../_shared/metaCredentials.ts";

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

    const creds = await resolveMetaPageCredentials(supabase, user.id);
    const pageToken = !("error" in creds) ? creds.pageAccessToken : null;
    const access = await resolveInstagramAccess({
      supabase,
      userId: user.id,
      pageAccessToken: pageToken,
    });
    if ("error" in access) return json({ error: access.error }, 400);

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    let igUserId = typeof connection.instagram_user_id === "string" ? connection.instagram_user_id.trim() : "";
    let igUsername = typeof connection.instagram_username === "string" ? connection.instagram_username : null;

    if (!igUserId && access.tokenSource === "facebook_page" && !("error" in creds)) {
      const lookupUrl = new URL(`https://graph.facebook.com/${graphVersion}/${creds.pageId}`);
      lookupUrl.searchParams.set(
        "fields",
        "instagram_business_account{id,username},connected_instagram_account{id,username}",
      );
      lookupUrl.searchParams.set("access_token", access.accessToken);
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

    if (!igUserId) {
      return json({
        error:
          "Instagram User ID is missing. Paste the numeric ID from Meta → Generate access tokens (under @carlojay.algordo).",
      }, 400);
    }

    const caption = captionOverride || String(draft.instagram_caption || "").trim();
    const imageUrl = String(draft.thumbnail_url || "").trim();
    const attemptAt = new Date().toISOString();

    await supabase
      .from("marketing_drafts")
      .update({
        instagram_provider_status: "posting",
        instagram_last_attempt_at: attemptAt,
        instagram_last_error: null,
      })
      .eq("id", draftId);

    const result = await postInstagramImage({
      igUserId,
      caption,
      imageUrl,
      graphVersion,
      accessToken: access.accessToken,
      apiHost: access.apiHost,
      tokenSource: access.tokenSource,
    });

    if (!result.ok) {
      await supabase.from("marketing_drafts").update(instagramFailurePatch(result.error, result.attemptAt)).eq("id", draftId);
      await supabase.from("meta_connections").update({
        status: "error",
        last_error: result.error,
        page_access_token_last4: tokenLast4(access.accessToken),
      }).eq("id", connection.id);
      return json({ error: result.error }, 502);
    }

    const { data: updatedDraft, error: updateErr } = await supabase
      .from("marketing_drafts")
      .update(instagramSuccessPatch(result.provider_post_id, result.attemptAt))
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
        page_access_token_last4: tokenLast4(access.accessToken),
      })
      .eq("id", connection.id);

    return json({
      ok: true,
      provider_post_id: result.provider_post_id,
      draft: updatedDraft,
      token_source: result.token_source,
    });
  } catch (err) {
    console.error("[meta-instagram-post-now]", err);
    return json({ error: String(err) }, 500);
  }
});
