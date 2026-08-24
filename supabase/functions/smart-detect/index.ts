// Smart hotspot detection: uses Lovable AI (Gemini vision) to OCR a flyer image
// and detect actionable items (phone, url, address, email, date/time) with bboxes.
import { filterSmartDetections } from "../_shared/smartDetectFilters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Detection {
  kind: "phone" | "url" | "email" | "address" | "date";
  text: string;
  // bbox in normalized 0..1 coords (relative to the image)
  bbox: { x: number; y: number; width: number; height: number };
  suggestedActionType: string;
  suggestedLabel: string;
}

const SYSTEM_PROMPT = `You are an OCR assistant for a flyer-design tool. Your ONLY job is to find machine-readable contact/action text.

Detect ONLY these categories:
- "phone": phone numbers (any country format)
- "url": website URLs (with or without protocol)
- "email": email addresses
- "address": physical street addresses (must include a street number AND street name; ignore standalone city/state names)
- "date": event dates and/or times

CRITICAL — DO NOT DETECT:
- Logos, icons, brand marks, mascots, photos, illustrations, QR codes, or decorative graphics
- Slogans, headlines, product names, or marketing copy unless they literally contain a phone, URL, email, address, or date/time
- Entire logo regions — never outline artwork; only the readable characters of contact text

Bounding boxes must tightly wrap ONLY the characters of the detected text (not surrounding graphics). Use normalized image coordinates (0.0-1.0), TOP-LEFT origin: x = left, y = top. When unsure, omit the detection.

Return STRICTLY a JSON object via the provided tool. Do NOT include any prose.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "report_detections",
    description: "Report all detected hotspot candidates from the flyer image.",
    parameters: {
      type: "object",
      properties: {
        detections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["phone", "url", "email", "address", "date"] },
              text: { type: "string", description: "The exact text as it appears" },
              bbox: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                },
                required: ["x", "y", "width", "height"],
                additionalProperties: false,
              },
            },
            required: ["kind", "text", "bbox"],
            additionalProperties: false,
          },
        },
      },
      required: ["detections"],
      additionalProperties: false,
    },
  },
};

function clamp01(n: number): number {
  if (typeof n !== "number" || isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function suggestionFor(kind: Detection["kind"], text: string): { type: string; label: string } {
  switch (kind) {
    case "phone": return { type: "call", label: `Call ${text}` };
    case "url": return { type: "open_url", label: `Open ${text}` };
    case "email": return { type: "open_url", label: `Email ${text}` };
    case "address": return { type: "map", label: `Open in maps` };
    case "date": return { type: "add_to_calendar", label: `Add to calendar` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const imageUrl: string | undefined = body?.imageUrl;
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Find ONLY phone numbers, street addresses, website URLs, email addresses, and event dates/times. Ignore logos, icons, photos, QR codes, and all other graphics.",
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "report_detections" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: { detections?: any[] } = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments ?? "{}");
    } catch (e) {
      console.error("Failed to parse tool call", e, toolCall?.function?.arguments);
    }

    const rawDetections: Detection[] = (parsed.detections ?? [])
      .filter((d: any) => d && d.kind && d.text && d.bbox)
      .map((d: any) => {
        const x = clamp01(d.bbox.x);
        const y = clamp01(d.bbox.y);
        const width = clamp01(d.bbox.width);
        const height = clamp01(d.bbox.height);
        const sug = suggestionFor(d.kind, d.text);
        return {
          kind: d.kind,
          text: String(d.text).trim(),
          bbox: { x, y, width: Math.max(0.01, width), height: Math.max(0.01, height) },
          suggestedActionType: sug.type,
          suggestedLabel: sug.label,
        };
      })
      .filter((d: Detection) => d.bbox.width > 0.005 && d.bbox.height > 0.005);

    const detections = filterSmartDetections(rawDetections);

    return new Response(JSON.stringify({ detections }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("smart-detect error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
