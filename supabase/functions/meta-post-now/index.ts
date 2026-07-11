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
    const messageOverride = typeof body.message === "string" ? body.message.trim() : "";
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

    // Use the logged-in user's Meta connection (admin/editor may post for a client flyer).
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
      await supabase
        .from("meta_connections")
        .update({
          status: "connected",
          last_error: "META_PAGE_ACCESS_TOKEN is missing",
          page_access_token_last4: null,
        })
        .eq("id", connection.id);
      return json({ error: "Missing META_PAGE_ACCESS_TOKEN secret" }, 400);
    }

    const message = messageOverride || String(draft.facebook_post || "").trim();
    if (!message) return json({ error: "No Facebook copy is ready yet" }, 400);

    const linkFromDraft = typeof draft.flyer_url === "string" ? draft.flyer_url.trim() : "";
    const linkFromMessage = (() => {
      const match = message.match(/https?:\/\/[^\s]+/i);
      return match?.[0]?.replace(/[),.;!?]+$/g, "") || "";
    })();
    const link = linkFromDraft || linkFromMessage;

    const attemptAt = new Date().toISOString();
    await supabase
      .from("marketing_drafts")
      .update({
        facebook_provider_status: "posting",
        facebook_last_attempt_at: attemptAt,
        facebook_last_error: null,
      })
      .eq("id", draftId);

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    const params = new URLSearchParams({
      message,
      access_token: pageAccessToken,
    });
    // Without `link`, Facebook often posts plain text and skips the OG preview card.
    if (link) params.set("link", link);

    const graphRes = await fetch(`https://graph.facebook.com/${graphVersion}/${connection.facebook_page_id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    let graphJson: Record<string, unknown> = {};
    try {
      graphJson = await graphRes.json();
    } catch {
      graphJson = {};
    }

    if (!graphRes.ok || typeof graphJson.id !== "string") {
      const providerError = String(
        graphJson.error && typeof graphJson.error === "object"
          ? (graphJson.error as Record<string, unknown>).message || "Facebook API request failed"
          : graphJson.error || "Facebook API request failed",
      ).slice(0, 500);

      const failurePatch = {
        facebook_status: "failed",
        facebook_error_message: providerError,
        facebook_provider_status: "failed",
        facebook_last_attempt_at: attemptAt,
        facebook_last_error: providerError,
      };

      await supabase.from("marketing_drafts").update(failurePatch).eq("id", draftId);
      await supabase
        .from("meta_connections")
        .update({
          status: "error",
          last_error: providerError,
          page_access_token_last4: pageAccessToken.slice(-4),
        })
        .eq("id", connection.id);

      return json({ error: providerError }, 502);
    }

    const successPatch = {
      facebook_status: "posted",
      facebook_posted_at: attemptAt,
      facebook_scheduled_for: null,
      facebook_error_message: null,
      facebook_provider_status: "posted",
      facebook_provider_post_id: graphJson.id,
      facebook_last_attempt_at: attemptAt,
      facebook_last_error: null,
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
        page_access_token_last4: pageAccessToken.slice(-4),
      })
      .eq("id", connection.id);

    return json({ ok: true, provider_post_id: graphJson.id, draft: updatedDraft });
  } catch (err) {
    console.error("[meta-post-now]", err);
    return json({ error: String(err) }, 500);
  }
});
