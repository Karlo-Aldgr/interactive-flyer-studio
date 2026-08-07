import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { publish } from "../_shared/publishing/service.ts";
import { extractLinkFromDraft } from "../_shared/metaFacebookPost.ts";

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

    const message = messageOverride || String(draft.facebook_post || "").trim();
    if (!message) return json({ error: "No Facebook copy is ready yet" }, 400);

    const thumbnailUrl = typeof draft.thumbnail_url === "string" ? draft.thumbnail_url.trim() : "";
    const outcome = await publish(supabase, {
      ownerId: String(draft.owner_id),
      platforms: ["facebook"],
      caption: message,
      media: thumbnailUrl ? [{ type: "image", url: thumbnailUrl }] : [],
      link: extractLinkFromDraft(draft as Record<string, unknown>, message),
      draftId,
    });

    const result = outcome.results[0];
    if (!result || result.status !== "success") {
      return json({ error: result?.error || "Facebook publish failed" }, 502);
    }

    const { data: updatedDraft } = await supabase
      .from("marketing_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    return json({
      ok: true,
      provider_post_id: result.post_id,
      token_source: result.token_source,
      draft: updatedDraft,
    });
  } catch (err) {
    console.error("[meta-post-now]", err);
    return json({ error: String(err) }, 500);
  }
});
