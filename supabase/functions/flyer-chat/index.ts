// Public: short Q&A about a published flyer (OpenAI). verify_jwt = false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTEXT_MAX = 4500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ChatTurn = { role: "user" | "assistant"; content: string };

function pushUnique(out: string[], value: string, maxLen = 280) {
  const t = value.replace(/\s+/g, " ").trim().slice(0, maxLen);
  if (!t) return;
  if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return;
  out.push(t);
}

function extractActionHints(payload: Record<string, unknown> | null, actionType: string): string[] {
  if (!payload) return [];
  const hints: string[] = [];
  const url = String(payload.url || "").trim();
  const phone = String(payload.phone || payload.phoneNumber || "").trim();
  const title = String(
    payload.title || payload.popupTitle || payload.formTitle || payload.videoTitle || "",
  ).trim();
  const message = String(payload.message || payload.smsBody || "").trim();
  const label = String(payload.label || payload.buttonLabel || "").trim();

  if (title) hints.push(`${actionType}: ${title}`);
  if (label && label !== title) hints.push(`label: ${label}`);
  if (url) hints.push(`link: ${url}`);
  if (phone) hints.push(`phone: ${phone}`);
  if (message) hints.push(`message: ${message.slice(0, 160)}`);

  // Common structured content
  const menu = payload.menuSections;
  if (Array.isArray(menu)) {
    for (const section of menu.slice(0, 8)) {
      if (!section || typeof section !== "object") continue;
      const sec = section as Record<string, unknown>;
      const name = String(sec.name || "").trim();
      if (name) hints.push(`menu section: ${name}`);
      const items = Array.isArray(sec.items) ? sec.items : [];
      for (const item of items.slice(0, 12)) {
        if (!item || typeof item !== "object") continue;
        const it = item as Record<string, unknown>;
        const itemName = String(it.name || "").trim();
        const price = String(it.price || "").trim();
        if (itemName) hints.push(price ? `${itemName} (${price})` : itemName);
      }
    }
  }

  const products = payload.products || payload.productGridItems;
  if (Array.isArray(products)) {
    for (const p of products.slice(0, 20)) {
      if (!p || typeof p !== "object") continue;
      const row = p as Record<string, unknown>;
      const name = String(row.name || "").trim();
      const price = String(row.price || "").trim();
      if (name) hints.push(price ? `product: ${name} (${price})` : `product: ${name}`);
    }
  }

  return hints;
}

function buildFlyerContext(pages: unknown[]): string {
  const texts: string[] = [];
  const actions: string[] = [];

  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const layers = Array.isArray((page as Record<string, unknown>).layers)
      ? (page as Record<string, unknown>).layers as unknown[]
      : [];

    for (const layer of layers) {
      if (!layer || typeof layer !== "object") continue;
      const l = layer as Record<string, unknown>;
      const content = l.content && typeof l.content === "object"
        ? l.content as Record<string, unknown>
        : {};
      pushUnique(texts, String(content.text || ""));
      pushUnique(texts, String(content.label || ""));

      const layerActions = Array.isArray(l.actions) ? l.actions : [];
      for (const act of layerActions) {
        if (!act || typeof act !== "object") continue;
        const a = act as Record<string, unknown>;
        const type = String(a.type || "action");
        const payload = a.payload && typeof a.payload === "object"
          ? a.payload as Record<string, unknown>
          : null;
        for (const hint of extractActionHints(payload, type)) {
          pushUnique(actions, hint, 220);
        }
      }
    }
  }

  const parts: string[] = [];
  if (texts.length) parts.push(`Visible text on flyer:\n- ${texts.slice(0, 60).join("\n- ")}`);
  if (actions.length) {
    parts.push(`Interactive actions / links:\n- ${actions.slice(0, 40).join("\n- ")}`);
  }
  return parts.join("\n\n").slice(0, CONTEXT_MAX);
}

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
      .select("id, title, public_slug, status, category")
      .eq("id", flyerId)
      .maybeSingle();

    if (flyerErr) return json({ error: flyerErr.message }, 500);
    if (!flyer) return json({ error: "Flyer not found" }, 404);
    if (flyer.status !== "published") {
      return json({ error: "Chatbot is available on published flyers only" }, 403);
    }

    const { data: pages } = await supabase
      .from("pages")
      .select("index, layers(type, content, actions(type, payload))")
      .eq("flyer_id", flyerId)
      .order("index", { ascending: true });

    const flyerContext = buildFlyerContext(Array.isArray(pages) ? pages : []);

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

    const category = flyer.category ? String(flyer.category) : "";
    const system =
      `You are a friendly helper on an interactive flyer called "${flyer.title || "Flyer"}"` +
      (category ? ` (category: ${category})` : "") +
      `. Public link: ${flyerUrl}.\n\n` +
      (flyerContext
        ? `Use ONLY the flyer facts below. Prefer them over guesses.\n\n${flyerContext}\n\n`
        : "No layer text was available; answer cautiously from the title only.\n\n") +
      "Answer briefly (1-4 short sentences). Help visitors understand the flyer and next steps. " +
      "If a link/phone/action is listed, you may point visitors to it. " +
      "If something is not in the flyer facts (prices, times, policies), say you don't know and point them to the flyer link. " +
      "Do not invent offers, prices, or guarantees. No markdown tables.";

    const model = Deno.env.get("OPENAI_MARKETING_MODEL")?.trim() || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 350,
        messages: [
          { role: "system", content: system },
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
