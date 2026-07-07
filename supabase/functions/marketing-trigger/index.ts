// Authenticated: forwards a pending marketing draft to n8n for AI generation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { draft_id } = await req.json().catch(() => ({}));
    if (!draft_id) return json({ error: "Missing draft_id" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: draft, error: draftErr } = await supabase
      .from("marketing_drafts")
      .select("*")
      .eq("id", draft_id)
      .maybeSingle();

    if (draftErr) return json({ error: draftErr.message }, 500);
    if (!draft) return json({ error: "Draft not found" }, 404);

    const isOwner = draft.owner_id === user.id;
    let canTrigger = isOwner;
    if (!canTrigger) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      const { data: isEditor } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "editor",
      });
      canTrigger = !!isAdmin || !!isEditor;
    }
    if (!canTrigger) return json({ error: "Forbidden" }, 403);

    const n8nUrl = Deno.env.get("N8N_MARKETING_WEBHOOK_URL")?.trim();
    if (!n8nUrl) {
      return json({ ok: true, skipped: true, reason: "N8N_MARKETING_WEBHOOK_URL not configured" });
    }

    await supabase
      .from("marketing_drafts")
      .update({ status: "processing" })
      .eq("id", draft_id);

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/marketing-draft-complete`;
    const secret = Deno.env.get("MARKETING_WEBHOOK_SECRET") ?? "";

    const payload = {
      draft_id: draft.id,
      flyer_id: draft.flyer_id,
      flyer_title: draft.flyer_title,
      flyer_url: draft.flyer_url,
      thumbnail_url: draft.thumbnail_url,
      callback_url: callbackUrl,
      callback_secret: secret,
    };

    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!n8nRes.ok) {
      const body = await n8nRes.text().catch(() => "");
      await supabase
        .from("marketing_drafts")
        .update({ status: "failed", error_message: `n8n error: ${n8nRes.status} ${body.slice(0, 200)}` })
        .eq("id", draft_id);
      return json({ error: "n8n webhook failed" }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("[marketing-trigger]", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
