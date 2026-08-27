// Generates a promotional caption + up to 3 hashtags for ONE flyer the caller
// owns. Reuses the existing Lovable AI gateway setup (same model/key as the
// automation-scripts function) and the flyer/job data already in the database.
// Strictly per-project: only the requested flyer's own record is read.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient } from "../_shared/social/store.ts";

const PLATFORM_STYLE: Record<string, string> = {
  instagram: "Instagram: warm, visual, 1-3 short sentences, at most 2 emojis.",
  facebook: "Facebook: natural promotional tone, 2-3 sentences, no emoji spam.",
  tiktok: "TikTok: short, punchy, hook-first, one line.",
  linkedin: "LinkedIn: professional, concise, no emojis.",
  x: "X: under 200 characters, punchy.",
  youtube: "YouTube: short descriptive line.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({}));
  const flyerId = typeof body.flyer_id === "string" ? body.flyer_id : "";
  const platform = typeof body.platform === "string" ? body.platform : "facebook";
  if (!flyerId) return json({ error: "Select a flyer first." }, 400);

  const supabase = serviceClient();

  const { data: flyer } = await supabase
    .from("flyers")
    .select("id, title, category, address, event_date, price_cents, chatbot_knowledge, owner_id, public_slug")
    .eq("id", flyerId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!flyer) return json({ error: "That flyer does not belong to you." }, 403);

  const { data: job } = await supabase
    .from("jobs")
    .select("title, brief")
    .eq("flyer_id", flyer.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ error: "AI is not configured." }, 500);

  const context = {
    platform,
    flyer_title: flyer.title,
    category: flyer.category,
    address: flyer.address,
    event_date: flyer.event_date,
    price: flyer.price_cents ? `$${(flyer.price_cents / 100).toFixed(2)}` : null,
    details: flyer.chatbot_knowledge,
    project_title: job?.title ?? null,
    project_brief: job?.brief ?? null,
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      instructions:
        "You are a small-business social media copywriter. Write a promotional caption for the described flyer only — never invent unrelated businesses, offers or facts. " +
        (PLATFORM_STYLE[platform] ?? PLATFORM_STYLE.facebook) +
        " Return at most 3 hashtags, each specific to this flyer, without the # symbol. No placeholders.",
      input: JSON.stringify(context),
      text: {
        format: {
          type: "json_schema",
          name: "social_caption",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              caption: { type: "string" },
              hashtags: { type: "array", items: { type: "string" }, maxItems: 3 },
            },
            required: ["caption", "hashtags"],
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("social-caption gateway error", res.status, detail.slice(0, 300));
    if (res.status === 429) return json({ error: "AI rate limit reached — try again shortly." }, 429);
    if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
    return json({ error: "Could not generate a caption." }, 500);
  }

  const payload = await res.json();
  const text = payload.output_text ??
    payload.output?.flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      ?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
  let parsed: { caption?: string; hashtags?: string[] } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "The AI response could not be read." }, 502);
  }

  return json({
    caption: (parsed.caption ?? "").trim(),
    hashtags: (parsed.hashtags ?? [])
      .map((h) => String(h).replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 3),
  });
});
