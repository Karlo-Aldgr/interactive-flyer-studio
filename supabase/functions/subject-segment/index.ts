// Refine a detected subject into a precise silhouette polygon for cutout extraction.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NormalizedPoint {
  x: number;
  y: number;
}

interface SubjectBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SYSTEM_PROMPT = `You are a visual segmentation assistant for a flyer editor (like Photoshop "Select Subject").

Given an image and a subject description with approximate bounding box, trace the PRECISE silhouette of that subject — not a rectangle.

Rules:
- Return a closed polygon outline that follows the visible edges of the subject.
- Use 12–48 points for smooth curves; more points on complex shapes.
- Coordinates are normalized 0.0–1.0 relative to the FULL image (top-left origin).
- Include only the requested subject; exclude background, shadows, and unrelated objects.
- The polygon should tightly hug the subject shape (e.g. a watch outline, not its rectangular bbox).
- Points must be ordered clockwise around the subject.

Return STRICTLY via the tool. No prose.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "report_segment",
    description: "Report the precise polygon silhouette of the subject.",
    parameters: {
      type: "object",
      properties: {
        polygon: {
          type: "array",
          description: "Closed polygon tracing the subject silhouette.",
          items: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
            },
            required: ["x", "y"],
            additionalProperties: false,
          },
        },
      },
      required: ["polygon"],
      additionalProperties: false,
    },
  },
};

function clamp01(n: number): number {
  if (typeof n !== "number" || isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function sanitizePolygon(raw: unknown): NormalizedPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
    .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }))
    .filter((p, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return Math.abs(p.x - prev.x) > 0.001 || Math.abs(p.y - prev.y) > 0.001;
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const imageUrl: string | undefined = body?.imageUrl;
    const label: string | undefined = body?.label;
    const bbox: SubjectBbox | undefined = body?.bbox;

    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bboxHint = bbox
      ? `Approximate region: x=${bbox.x.toFixed(3)}, y=${bbox.y.toFixed(3)}, width=${bbox.width.toFixed(3)}, height=${bbox.height.toFixed(3)} (normalized).`
      : "";

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
                text: `Segment this subject precisely: "${label || "main object"}". ${bboxHint}`.trim(),
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "report_segment" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: { polygon?: unknown } = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments ?? "{}");
    } catch (e) {
      console.error("Failed to parse tool call", e, toolCall?.function?.arguments);
    }

    const polygon = sanitizePolygon(parsed.polygon);
    if (polygon.length < 3) {
      return new Response(JSON.stringify({ error: "Could not segment subject — try manual rectangle select" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ polygon }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("subject-segment error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
