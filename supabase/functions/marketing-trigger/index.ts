// Authenticated: generate marketing copy (OpenAI direct) or forward to n8n.
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

async function generateWithOpenAI(args: {
  apiKey: string;
  title: string;
  flyerUrl: string;
}): Promise<{ facebook_post: string; instagram_caption: string }> {
  const model = Deno.env.get("OPENAI_MARKETING_MODEL")?.trim() || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write short social posts for interactive digital flyers. Always include the exact flyer URL. Return ONLY JSON with keys facebook_post and instagram_caption. Do not invent prices or offers not in the title.",
        },
        {
          role: "user",
          content: `Flyer title: ${args.title}\nPublic link: ${args.flyerUrl}\n\nWrite:\n1) facebook_post: 2-4 short paragraphs, friendly, end with the link\n2) instagram_caption: shorter, hashtags ok, end with the link`,
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const errObj = data.error && typeof data.error === "object"
      ? data.error as Record<string, unknown>
      : null;
    throw new Error(String(errObj?.message || data.error || `OpenAI HTTP ${res.status}`));
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const message = choices[0] && typeof choices[0] === "object"
    ? (choices[0] as Record<string, unknown>).message
    : null;
  const content = message && typeof message === "object"
    ? String((message as Record<string, unknown>).content || "")
    : "";

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned non-JSON marketing copy");
  }

  const facebook_post = String(parsed.facebook_post || "").trim();
  const instagram_caption = String(parsed.instagram_caption || "").trim();
  if (!facebook_post && !instagram_caption) {
    throw new Error("OpenAI returned empty facebook_post and instagram_caption");
  }
  return { facebook_post, instagram_caption };
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

    const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim() || "";
    const n8nUrl = Deno.env.get("N8N_MARKETING_WEBHOOK_URL")?.trim();

    if (!openaiKey && !n8nUrl) {
      return json({
        ok: true,
        skipped: true,
        reason: "OPENAI_API_KEY and N8N_MARKETING_WEBHOOK_URL are not configured",
      });
    }

    await supabase
      .from("marketing_drafts")
      .update({ status: "processing", error_message: null })
      .eq("id", draft_id);

    // Prefer direct OpenAI so drafts don't depend on n8n callback wiring.
    if (openaiKey) {
      try {
        const copy = await generateWithOpenAI({
          apiKey: openaiKey,
          title: String(draft.flyer_title || "Flyer"),
          flyerUrl: String(draft.flyer_url || ""),
        });
        const { error: saveErr } = await supabase
          .from("marketing_drafts")
          .update({
            status: "ready",
            facebook_post: copy.facebook_post.slice(0, 4000) || null,
            instagram_caption: copy.instagram_caption.slice(0, 4000) || null,
            error_message: null,
          })
          .eq("id", draft_id);
        if (saveErr) return json({ error: saveErr.message }, 500);
        return json({ ok: true, source: "openai_direct" });
      } catch (err) {
        const message = String(err).slice(0, 500);
        await supabase
          .from("marketing_drafts")
          .update({ status: "failed", error_message: message })
          .eq("id", draft_id);
        return json({ error: message }, 502);
      }
    }

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

    const n8nRes = await fetch(n8nUrl!, {
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

    return json({ ok: true, source: "n8n" });
  } catch (err) {
    console.error("[marketing-trigger]", err);
    return json({ error: String(err) }, 500);
  }
});
