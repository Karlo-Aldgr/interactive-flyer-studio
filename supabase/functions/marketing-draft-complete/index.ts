// Public callback from n8n — saves generated Facebook + Instagram copy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-marketing-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const expected = Deno.env.get("MARKETING_WEBHOOK_SECRET")?.trim();
    const provided = req.headers.get("x-marketing-secret")?.trim()
      ?? (typeof body.callback_secret === "string" ? body.callback_secret : undefined);

    if (!expected || provided !== expected) {
      return json({ error: "Unauthorized" }, 401);
    }
    const draftId = body.draft_id as string | undefined;
    if (!draftId) return json({ error: "Missing draft_id" }, 400);

    const failed = body.status === "failed";
    const patch = failed
      ? {
          status: "failed",
          error_message: String(body.error_message || body.error || "Generation failed").slice(0, 500),
        }
      : {
          status: "ready",
          facebook_post: String(body.facebook_post || "").slice(0, 4000),
          instagram_caption: String(body.instagram_caption || "").slice(0, 4000),
          error_message: null,
        };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase
      .from("marketing_drafts")
      .update(patch)
      .eq("id", draftId);

    if (error) {
      console.error("[marketing-draft-complete]", error.message);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("[marketing-draft-complete]", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
