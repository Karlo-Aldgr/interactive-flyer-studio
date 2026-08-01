// Authenticated: generate landing-page copy for a flyer from its content + business profile.
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

function pushUnique(out: string[], value: string, maxLen = 200) {
  const t = value.replace(/\s+/g, " ").trim().slice(0, maxLen);
  if (!t) return;
  if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return;
  out.push(t);
}

function collect(pages: unknown[]): { texts: string[]; images: string[]; actions: string[] } {
  const texts: string[] = [];
  const images: string[] = [];
  const actions: string[] = [];
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const layers = Array.isArray((page as Record<string, unknown>).layers)
      ? ((page as Record<string, unknown>).layers as unknown[])
      : [];
    for (const layer of layers) {
      if (!layer || typeof layer !== "object") continue;
      const l = layer as Record<string, unknown>;
      const content = l.content && typeof l.content === "object" ? (l.content as Record<string, unknown>) : {};
      pushUnique(texts, String(content.text || ""));
      pushUnique(texts, String(content.label || ""));
      const src = String(content.src || "");
      if (src.startsWith("http") && !images.includes(src)) images.push(src);
      const acts = Array.isArray(l.actions) ? l.actions : [];
      for (const a of acts) {
        if (a && typeof a === "object") pushUnique(actions, String((a as Record<string, unknown>).type || ""));
      }
    }
  }
  return { texts, images, actions };
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
    const ctaPreference = String(body.cta_label || "").trim().slice(0, 40);
    const notes = String(body.notes || "").trim().slice(0, 500);

    const lovableKey = Deno.env.get("LOVABLE_API_KEY")?.trim();
    if (!lovableKey) return json({ error: "AI is not configured" }, 503);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: flyer, error: flyerErr } = await supabase
      .from("flyers")
      .select("id, title, category, owner_id, thumbnail_url")
      .eq("id", flyerId)
      .maybeSingle();
    if (flyerErr) return json({ error: flyerErr.message }, 500);
    if (!flyer) return json({ error: "Flyer not found" }, 404);

    let canRun = flyer.owner_id === user.id;
    if (!canRun) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const { data: isEditor } = await supabase.rpc("has_role", { _user_id: user.id, _role: "editor" });
      canRun = !!isAdmin || !!isEditor;
    }
    if (!canRun) return json({ error: "Forbidden" }, 403);

    const { data: pages } = await supabase
      .from("pages")
      .select("index, layers(type, content, actions(type))")
      .eq("flyer_id", flyerId)
      .order("index", { ascending: true });

    const { texts, images, actions } = collect(Array.isArray(pages) ? pages : []);

    const { data: business } = await supabase
      .from("onboarding_submissions")
      .select(
        "business_name, business_slogan, business_description, business_address, phone, email, website_url, logo_url, facebook_url, instagram_url",
      )
      .eq("user_id", flyer.owner_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const businessLines = business
      ? Object.entries(business)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => `${k}: ${String(v).trim()}`)
        .join("\n")
      : "(no business profile on file)";

    const context = [
      `Flyer title: ${flyer.title || "Untitled"}`,
      `Category: ${flyer.category || "n/a"}`,
      `Existing interactions: ${actions.join(", ") || "none"}`,
      "",
      "Business profile:",
      businessLines,
      "",
      "Flyer copy found on the pages:",
      texts.length ? `- ${texts.slice(0, 40).join("\n- ")}` : "(no extractable text — copy is baked into images)",
      notes ? `\nExtra instructions from the user: ${notes}` : "",
    ].join("\n").slice(0, CONTEXT_MAX);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": lovableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write short, high-converting landing page copy for interactive digital flyers. " +
              "Return ONLY JSON with keys: headline (max 60 chars), subheadline (max 110 chars), " +
              "bullets (array of exactly 3 strings, max 48 chars each), ctaLabel (max 22 chars), " +
              "footerLine (max 90 chars, contact/address info if available), accentColor (hex like #7c3aed). " +
              "Never invent offers, prices, or claims that are not in the provided facts. " +
              "Write in the same language as the flyer copy.",
          },
          {
            role: "user",
            content: ctaPreference
              ? `${context}\n\nUse this call-to-action wording if it fits: "${ctaPreference}".`
              : context,
          },
        ],
      }),
    });

    if (res.status === 429) return json({ error: "AI is busy right now — try again in a moment." }, 429);
    if (res.status === 402) return json({ error: "AI credits exhausted. Add credits to continue." }, 402);

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const errObj = data.error && typeof data.error === "object" ? (data.error as Record<string, unknown>) : null;
      return json({ error: String(errObj?.message || data.error || `AI HTTP ${res.status}`) }, 502);
    }

    const choices = Array.isArray(data.choices) ? data.choices : [];
    const msg = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>).message : null;
    const content = msg && typeof msg === "object" ? String((msg as Record<string, unknown>).content || "") : "";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return json({ error: "AI returned an unreadable response — try again." }, 502);
    }

    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.map((b) => String(b)).filter(Boolean).slice(0, 3)
      : [];

    return json({
      ok: true,
      spec: {
        headline: String(parsed.headline || flyer.title || "Welcome"),
        subheadline: String(parsed.subheadline || ""),
        bullets,
        ctaLabel: String(parsed.ctaLabel || ctaPreference || "Shop now").slice(0, 22),
        footerLine: String(parsed.footerLine || ""),
        accentColor: /^#[0-9a-fA-F]{6}$/.test(String(parsed.accentColor || "")) ? String(parsed.accentColor) : "#7c3aed",
        heroImage: images[0] || flyer.thumbnail_url || null,
        logoUrl: (business as Record<string, unknown> | null)?.logo_url || null,
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
