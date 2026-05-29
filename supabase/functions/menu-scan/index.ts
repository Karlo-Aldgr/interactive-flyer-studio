// Scan a menu photo with Lovable AI vision and return structured sections + items.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an OCR + classification assistant for restaurant/cafe menus.
You will be given a single menu photo. Extract every visible menu item.

Group items into sections based on the headings/layout of the menu. If no clear sections exist, put everything in a single section called "Menu".

For each item, classify its category as one of:
- "main": main dishes, entrees, mains, sandwiches, pizzas, pasta, burgers
- "side": sides, fries, salads served as sides, appetizers, small plates
- "drink": all beverages, alcoholic and non-alcoholic
- "dessert": desserts, sweets, ice cream, pastries
- "other": anything else

CRITICAL: For EVERY item you MUST return a tight normalized bounding box \`bbox\` covering the row (item name + price area) on the photo, where x/y is the top-left and w/h are width/height — all in 0..1 relative to image dimensions. Be tight: do not cover empty space. If you are not 100% sure about the box, return your BEST ESTIMATE — NEVER omit bbox. An item without bbox is invalid output.

Return numeric price (no currency symbol). If the price is missing, use 0.
Return STRICTLY via the tool. No prose.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "report_menu",
    description: "Report the parsed menu structure with bounding boxes.",
    parameters: {
      type: "object",
      properties: {
        imageWidth: { type: "number", description: "Apparent pixel width of the menu image (optional)" },
        imageHeight: { type: "number", description: "Apparent pixel height of the menu image (optional)" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    price: { type: "number" },
                    category: { type: "string", enum: ["main", "side", "drink", "dessert", "other"] },
                    bbox: {
                      type: "object",
                      properties: {
                        x: { type: "number" }, y: { type: "number" },
                        w: { type: "number" }, h: { type: "number" },
                      },
                      required: ["x", "y", "w", "h"],
                      additionalProperties: false,
                    },
                  },
                  required: ["name", "price", "category", "bbox"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name", "items"],
            additionalProperties: false,
          },
        },
      },
      required: ["sections"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Parse this menu. Every item MUST include bbox." },
            { type: "image_url", image_url: { url: imageUrl } },
          ] },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "report_menu" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI request failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = {};
    try { parsed = JSON.parse(toolCall?.function?.arguments ?? "{}"); } catch (e) { console.error("Parse fail", e); }

    const clamp01 = (n: any) => Math.max(0, Math.min(1, Number(n) || 0));
    const validBbox = (b: any) =>
      b && ["x", "y", "w", "h"].every(k => typeof b[k] === "number") &&
      Number(b.w) > 0.005 && Number(b.h) > 0.005;

    const sectionsRaw = (parsed.sections ?? []) as any[];

    // Flatten then group per section so we can stack fallback boxes per section.
    // Determine vertical bands per section based on items WITH bbox to keep fallbacks
    // visually near where the model thought items were.
    const sections = sectionsRaw.map((s: any, sIdx: number) => {
      const items = (s.items ?? []) as any[];
      const withBox = items.filter((it) => validBbox(it.bbox));
      // Section vertical band
      let bandTop = 0;
      let bandBottom = 1;
      if (withBox.length > 0) {
        bandTop = Math.max(0, Math.min(...withBox.map((it) => clamp01(it.bbox.y))) - 0.02);
        bandBottom = Math.min(1, Math.max(...withBox.map((it) => clamp01(it.bbox.y) + clamp01(it.bbox.h))) + 0.02);
      } else {
        // No boxes for this section → divide image vertically across sections.
        const slice = 1 / Math.max(1, sectionsRaw.length);
        bandTop = sIdx * slice;
        bandBottom = (sIdx + 1) * slice;
      }
      const bandH = Math.max(0.05, bandBottom - bandTop);

      // Stack fallback items only across those missing bbox
      const missing = items.filter((it) => !validBbox(it.bbox));
      const slotH = missing.length > 0 ? bandH / missing.length : 0;
      let mi = 0;

      return {
        id: crypto.randomUUID(),
        name: String(s.name || "Menu"),
        items: items.map((it: any) => {
          let bbox: { x: number; y: number; w: number; h: number };
          if (validBbox(it.bbox)) {
            bbox = {
              x: clamp01(it.bbox.x),
              y: clamp01(it.bbox.y),
              w: clamp01(it.bbox.w),
              h: clamp01(it.bbox.h),
            };
          } else {
            // Synthesize fallback inside the section band.
            const y = bandTop + mi * slotH;
            mi += 1;
            bbox = {
              x: 0.05,
              y: clamp01(y + slotH * 0.05),
              w: 0.9,
              h: clamp01(Math.max(0.04, slotH * 0.9)),
            };
          }
          return {
            id: crypto.randomUUID(),
            name: String(it.name || ""),
            description: it.description ? String(it.description) : "",
            price: typeof it.price === "number" ? it.price : Number(it.price) || 0,
            category: ["main", "side", "drink", "dessert", "other"].includes(it.category) ? it.category : "other",
            color: "",
            upsell: it.category === "side" || it.category === "drink",
            bbox,
          };
        }),
      };
    });

    return new Response(JSON.stringify({ sections }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("menu-scan error", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
