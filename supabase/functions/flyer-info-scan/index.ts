// Scan a flyer image with Lovable AI vision and extract business/contact info
// used to pre-fill the onboarding form.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You read a business flyer image and extract the business's contact and brand details.
Only report what is actually visible on the flyer. Never invent data. Leave a field as an empty string when it is not present.
Normalize URLs (add https:// when missing). Phone numbers keep their printed format.
Return STRICTLY via the provided tool. No prose.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "report_business_info",
    description: "Report business details found on the flyer.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "Contact person's name if shown" },
        phone: { type: "string" },
        email: { type: "string" },
        business_name: { type: "string" },
        business_slogan: { type: "string", description: "Slogan or tagline" },
        business_address: { type: "string" },
        business_description: { type: "string", description: "Short description of what the business offers, based on the flyer" },
        website_url: { type: "string" },
        facebook_url: { type: "string" },
        instagram_url: { type: "string" },
        tiktok_url: { type: "string" },
        other_social_url: { type: "string" },
        facebook_page_name: { type: "string" },
        instagram_handle: { type: "string" },
      },
      required: [
        "full_name", "phone", "email", "business_name", "business_slogan",
        "business_address", "business_description", "website_url",
        "facebook_url", "instagram_url", "tiktok_url", "other_social_url",
        "facebook_page_name", "instagram_handle",
      ],
      additionalProperties: false,
    },
  },
};

const FIELDS = TOOL_DEF.function.parameters.required;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const imageUrl: string | undefined = body?.imageUrl;
    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "imageUrl is required" }, 400);
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
              { type: "text", text: "Extract the business details from this flyer." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "report_business_info" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) return json({ error: "Rate limit exceeded. Try again in a minute." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add funds in Workspace → Usage." }, 402);
      return json({ error: "AI request failed" }, 500);
    }

    const data = await aiResp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(args ?? "{}");
    } catch (e) {
      console.error("Failed to parse tool call", e, args);
    }

    const info: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = parsed[f];
      info[f] = typeof v === "string" ? v.trim() : "";
    }

    return json({ info });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("flyer-info-scan error", msg);
    return json({ error: msg }, 500);
  }
});
