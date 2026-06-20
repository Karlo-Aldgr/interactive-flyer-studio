// Detect visual subjects in a flyer/photo image for interactive object extraction.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SubjectCategory =
  | "person"
  | "face"
  | "animal"
  | "house"
  | "building"
  | "tree"
  | "plant"
  | "product"
  | "logo"
  | "vehicle"
  | "text"
  | "food"
  | "furniture"
  | "object";

interface SubjectDetection {
  id: string;
  label: string;
  category: SubjectCategory;
  bbox: { x: number; y: number; width: number; height: number };
}

const SYSTEM_PROMPT = `You are a visual subject-detection assistant for an interactive flyer editor (similar to Photoshop "Select Subject").

Given a single image, identify every distinct, extractable visual subject a user might want to make clickable/interactive.

Detect subjects such as:
- person, face, animal
- house, building, tree, plant
- product, logo, vehicle, food, furniture
- readable text blocks (headlines, labels — not tiny fine print)
- any other prominent object

Rules:
- Return TIGHT bounding boxes in normalized image coordinates (0.0–1.0), top-left origin.
- x = left edge, y = top edge, width and height are positive fractions of image size.
- Prefer fewer, meaningful subjects over hundreds of tiny fragments.
- Skip full-image background/sky/empty regions unless they are the only subject.
- label: short human name (e.g. "Woman in red dress", "Company logo", "Red sports car").
- category: one of the allowed enum values; use "object" when unsure.
- Assign a stable id like "subj-1", "subj-2" for each detection.

Return STRICTLY via the tool. No prose.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "report_subjects",
    description: "Report detected visual subjects with bounding boxes.",
    parameters: {
      type: "object",
      properties: {
        subjects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              category: {
                type: "string",
                enum: [
                  "person", "face", "animal", "house", "building", "tree", "plant",
                  "product", "logo", "vehicle", "text", "food", "furniture", "object",
                ],
              },
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
            required: ["id", "label", "category", "bbox"],
            additionalProperties: false,
          },
        },
      },
      required: ["subjects"],
      additionalProperties: false,
    },
  },
};

function clamp01(n: number): number {
  if (typeof n !== "number" || isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
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
              { type: "text", text: "Detect all extractable subjects in this image." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "report_subjects" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 401 || aiResp.status === 403) {
        return new Response(
          JSON.stringify({
            error:
              "LOVABLE_API_KEY is invalid — rotate it in Lovable Cloud → Secrets, redeploy edge functions, then update CarloSample with the same key.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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
    let parsed: { subjects?: any[] } = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments ?? "{}");
    } catch (e) {
      console.error("Failed to parse tool call", e, toolCall?.function?.arguments);
    }

    const subjects: SubjectDetection[] = (parsed.subjects ?? [])
      .filter((s: any) => s && s.label && s.bbox)
      .map((s: any, i: number) => {
        const x = clamp01(s.bbox.x);
        const y = clamp01(s.bbox.y);
        const width = clamp01(s.bbox.width);
        const height = clamp01(s.bbox.height);
        return {
          id: String(s.id || `subj-${i + 1}`),
          label: String(s.label).trim().slice(0, 80),
          category: (s.category || "object") as SubjectCategory,
          bbox: {
            x,
            y,
            width: Math.max(0.01, Math.min(1 - x, width)),
            height: Math.max(0.01, Math.min(1 - y, height)),
          },
        };
      })
      .filter((s: SubjectDetection) => s.bbox.width > 0.008 && s.bbox.height > 0.008);

    return new Response(JSON.stringify({ subjects }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("subject-detect error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
