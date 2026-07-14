// Public: short Q&A about a published flyer (OpenAI). verify_jwt = false.
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

type ChatTurn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const flyerId = String(body.flyer_id || "").trim();
    const message = String(body.message || "").trim().slice(0, 500);
    const rawHistory = Array.isArray(body.history) ? body.history : [];

    if (!flyerId) return json({ error: "Missing flyer_id" }, 400);
    if (!message) return json({ error: "Missing message" }, 400);

    const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!openaiKey) return json({ error: "OPENAI_API_KEY is not configured" }, 503);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: flyer, error: flyerErr } = await supabase
      .from("flyers")
      .select("id, title, public_slug, status, thumbnail_url")
      .eq("id", flyerId)
      .maybeSingle();

    if (flyerErr) return json({ error: flyerErr.message }, 500);
    if (!flyer) return json({ error: "Flyer not found" }, 404);
    if (flyer.status !== "published") {
      return json({ error: "Chatbot is available on published flyers only" }, 403);
    }

    const site = Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://tapthatflyer.com";
    const flyerUrl = flyer.public_slug
      ? `${site.replace(/\/$/, "")}/f/${flyer.public_slug}`
      : site;

    const history: ChatTurn[] = [];
    for (const turn of rawHistory.slice(-6)) {
      if (!turn || typeof turn !== "object") continue;
      const role = (turn as Record<string, unknown>).role;
      const content = String((turn as Record<string, unknown>).content || "").trim().slice(0, 800);
      if ((role === "user" || role === "assistant") && content) {
        history.push({ role, content });
      }
    }

    const model = Deno.env.get("OPENAI_MARKETING_MODEL")?.trim() || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content:
              `You are a friendly helper on an interactive flyer called "${flyer.title || "Flyer"}". ` +
              `Public link: ${flyerUrl}. ` +
              "Answer briefly (1-4 short sentences). Help visitors understand the flyer and next steps. " +
              "If you don't know something (prices, times, policies not in the title), say you don't know and point them to the flyer link. " +
              "Do not invent offers, prices, or guarantees. No markdown tables.",
          },
          ...history,
          { role: "user", content: message },
        ],
      }),
    });

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const errObj = data.error && typeof data.error === "object"
        ? data.error as Record<string, unknown>
        : null;
      return json({ error: String(errObj?.message || data.error || `OpenAI HTTP ${res.status}`) }, 502);
    }

    const choices = Array.isArray(data.choices) ? data.choices : [];
    const msg = choices[0] && typeof choices[0] === "object"
      ? (choices[0] as Record<string, unknown>).message
      : null;
    const reply = msg && typeof msg === "object"
      ? String((msg as Record<string, unknown>).content || "").trim()
      : "";

    if (!reply) return json({ error: "Empty chatbot reply" }, 502);
    return json({ ok: true, reply: reply.slice(0, 2000) });
  } catch (err) {
    console.error("[flyer-chat]", err);
    return json({ error: String(err) }, 500);
  }
});
