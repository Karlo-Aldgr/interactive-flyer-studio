// Authenticated: AI Marketing Coach scores a flyer before / after publish.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTEXT_MAX = 4000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pushUnique(out: string[], value: string, maxLen = 240) {
  const t = value.replace(/\s+/g, " ").trim().slice(0, maxLen);
  if (!t) return;
  if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return;
  out.push(t);
}

function buildFlyerFacts(pages: unknown[]): { textCount: number; actionCount: number; summary: string } {
  const texts: string[] = [];
  const actions: string[] = [];

  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const layers = Array.isArray((page as Record<string, unknown>).layers)
      ? ((page as Record<string, unknown>).layers as unknown[])
      : [];
    for (const layer of layers) {
      if (!layer || typeof layer !== "object") continue;
      const l = layer as Record<string, unknown>;
      const content = l.content && typeof l.content === "object"
        ? (l.content as Record<string, unknown>)
        : {};
      pushUnique(texts, String(content.text || ""));
      pushUnique(texts, String(content.label || ""));

      const layerActions = Array.isArray(l.actions) ? l.actions : [];
      for (const act of layerActions) {
        if (!act || typeof act !== "object") continue;
        const a = act as Record<string, unknown>;
        const type = String(a.type || "action");
        const payload = a.payload && typeof a.payload === "object"
          ? (a.payload as Record<string, unknown>)
          : {};
        const title = String(
          payload.title || payload.subscribeTitle || payload.productName || payload.eventTitle || "",
        ).trim();
        const url = String(payload.url || payload.checkoutUrl || payload.productPaymentUrl || "").trim();
        const label = String(payload.label || payload.ticketCtaLabel || payload.productCtaLabel || "").trim();
        pushUnique(
          actions,
          [type, title || label, url].filter(Boolean).join(" · "),
          200,
        );
      }
    }
  }

  const parts: string[] = [];
  if (texts.length) parts.push(`Text layers:\n- ${texts.slice(0, 40).join("\n- ")}`);
  if (actions.length) parts.push(`Interactive actions:\n- ${actions.slice(0, 30).join("\n- ")}`);
  return {
    textCount: texts.length,
    actionCount: actions.length,
    summary: parts.join("\n\n").slice(0, CONTEXT_MAX),
  };
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
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
    const flyerId = String(body.flyer_id || "").trim();
    if (!flyerId) return json({ error: "Missing flyer_id" }, 400);

    const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!openaiKey) return json({ error: "OPENAI_API_KEY is not configured" }, 503);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: flyer, error: flyerErr } = await supabase
      .from("flyers")
      .select("id, title, public_slug, status, category, owner_id")
      .eq("id", flyerId)
      .maybeSingle();

    if (flyerErr) return json({ error: flyerErr.message }, 500);
    if (!flyer) return json({ error: "Flyer not found" }, 404);

    const isOwner = flyer.owner_id === user.id;
    let canRun = isOwner;
    if (!canRun) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      const { data: isEditor } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "editor",
      });
      canRun = !!isAdmin || !!isEditor;
    }
    if (!canRun) return json({ error: "Forbidden" }, 403);

    const { data: pages } = await supabase
      .from("pages")
      .select("index, layers(type, content, actions(type, payload))")
      .eq("flyer_id", flyerId)
      .order("index", { ascending: true });

    const facts = buildFlyerFacts(Array.isArray(pages) ? pages : []);
    const site = Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://tapthatflyer.com";
    const flyerUrl = flyer.public_slug
      ? `${site.replace(/\/$/, "")}/f/${flyer.public_slug}`
      : "(not published yet)";

    const model = Deno.env.get("OPENAI_MARKETING_MODEL")?.trim() || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You are an AI Marketing Coach for interactive digital flyers (TapThatFlyer). " +
              "Score marketing effectiveness before or after publish. Return ONLY JSON with keys: " +
              "overall (0-100 number), summary (2-3 sentences), scores (object with keys " +
              "headline, cta, readability, contrast, audience, conversion — each {score:0-10, tip:string}), " +
              "recommendations (array of up to 5 short actionable strings). " +
              "If text is sparse because copy is baked into images, say so and still coach on interactions/CTA/hotspots. " +
              "Do not invent offers or claims not present in the facts. Contrast tip may note when pixel contrast cannot be measured.",
          },
          {
            role: "user",
            content:
              `Flyer title: ${flyer.title || "Untitled"}\n` +
              `Status: ${flyer.status}\n` +
              `Category: ${flyer.category || "n/a"}\n` +
              `Public link: ${flyerUrl}\n` +
              `Text layer count: ${facts.textCount}\n` +
              `Interactive action count: ${facts.actionCount}\n\n` +
              (facts.summary || "(No extractable layer text or actions.)"),
          },
        ],
      }),
    });

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const errObj = data.error && typeof data.error === "object"
        ? (data.error as Record<string, unknown>)
        : null;
      return json({ error: String(errObj?.message || data.error || `OpenAI HTTP ${res.status}`) }, 502);
    }

    const choices = Array.isArray(data.choices) ? data.choices : [];
    const msg = choices[0] && typeof choices[0] === "object"
      ? (choices[0] as Record<string, unknown>).message
      : null;
    const content = msg && typeof msg === "object"
      ? String((msg as Record<string, unknown>).content || "")
      : "";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return json({ error: "OpenAI returned non-JSON coaching result" }, 502);
    }

    const rawScores = parsed.scores && typeof parsed.scores === "object"
      ? (parsed.scores as Record<string, unknown>)
      : {};

    const scoreKeys = ["headline", "cta", "readability", "contrast", "audience", "conversion"] as const;
    const scores: Record<string, { score: number; tip: string }> = {};
    for (const key of scoreKeys) {
      const row = rawScores[key] && typeof rawScores[key] === "object"
        ? (rawScores[key] as Record<string, unknown>)
        : {};
      scores[key] = {
        score: clampScore(row.score),
        tip: String(row.tip || "").trim().slice(0, 280) || "No tip provided.",
      };
    }

    let overall = typeof parsed.overall === "number" ? parsed.overall : Number(parsed.overall);
    if (!Number.isFinite(overall)) {
      const avg = scoreKeys.reduce((s, k) => s + scores[k].score, 0) / scoreKeys.length;
      overall = Math.round(avg * 10);
    }
    overall = Math.max(0, Math.min(100, Math.round(overall)));

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
        .map((r) => String(r || "").trim())
        .filter(Boolean)
        .slice(0, 5)
      : [];

    return json({
      ok: true,
      overall,
      summary: String(parsed.summary || "").trim().slice(0, 600),
      scores,
      recommendations,
      meta: {
        text_layers: facts.textCount,
        actions: facts.actionCount,
        status: flyer.status,
      },
    });
  } catch (err) {
    console.error("[flyer-coach]", err);
    return json({ error: String(err) }, 500);
  }
});
