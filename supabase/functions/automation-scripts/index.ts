import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SHEET_SETTING_KEY = "automation_master_sheet_id";
const SHEET_TAB = "Automation Requests";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

const HEADER = [
  "Request ID",
  "Created at",
  "Flyer",
  "Flyer ID",
  "Customer email",
  "Status",
  "Priority",
  "Custom request",
  "Facebook post",
  "Instagram caption",
  "TikTok caption",
  "Email subject",
  "Email body",
  "SMS message",
  "Video script",
  "Staff notes",
  "Last synced",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateScripts(context: Record<string, unknown>) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      stream: true,
      instructions:
        "You are a small-business marketing copywriter. Write ready-to-post promotional scripts for the flyer described by the user. The video script must be a short-form (30-45 second) video script with spoken lines plus brief on-screen shot directions. Keep the brand voice friendly and concrete. No hashtags spam, no emojis overload, no placeholders like [NAME].",
      input: JSON.stringify(context),
      text: {
        format: {
          type: "json_schema",
          name: "marketing_scripts",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              facebook_post: { type: "string" },
              instagram_caption: { type: "string" },
              tiktok_caption: { type: "string" },
              email_subject: { type: "string" },
              email_body: { type: "string" },
              sms_body: { type: "string" },
              video_script: { type: "string" },
            },
            required: [
              "facebook_post",
              "instagram_caption",
              "tiktok_caption",
              "email_subject",
              "email_body",
              "sms_body",
              "video_script",
            ],
          },
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text();
    console.error(`AI gateway failed [${res.status}]: ${detail}`);
    throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  // Reasoning models must stream; accumulate the output text deltas.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && !text) {
          text = evt.response?.output_text ?? "";
        }
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  if (!text.trim()) throw new Error("The AI returned an empty draft. Please try again.");
  return JSON.parse(text) as Record<string, string>;
}

async function syncToSheet(
  admin: ReturnType<typeof createClient>,
  req: Record<string, any>,
  flyerTitle: string,
  customerEmail: string,
) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const sheetsKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");

  // Each customer exports to their own spreadsheet; the master sheet is a fallback.
  const { data: profile } = await admin
    .from("profiles")
    .select("automation_sheet_id, automation_sheet_tab")
    .eq("id", req.owner_id)
    .maybeSingle();
  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", SHEET_SETTING_KEY)
    .maybeSingle();
  const spreadsheetId =
    (profile?.automation_sheet_id as string | null)?.trim() ||
    ((setting?.value as any)?.spreadsheet_id as string | undefined);
  const tab = (profile?.automation_sheet_tab as string | null)?.trim() || SHEET_TAB;

  if (!lovableKey || !sheetsKey) return { skipped: "Google Sheets is not connected yet." };
  if (!spreadsheetId) {
    return { skipped: "No Google Sheet on file for this customer. Add one in onboarding." };
  }

  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": sheetsKey,
    "Content-Type": "application/json",
  };


  const row = [
    req.id,
    req.created_at,
    flyerTitle,
    req.flyer_id,
    customerEmail,
    req.status,
    req.priority,
    req.custom_request ?? "",
    req.facebook_post ?? "",
    req.instagram_caption ?? "",
    req.tiktok_caption ?? "",
    req.email_subject ?? "",
    req.email_body ?? "",
    req.sms_body ?? "",
    req.video_script ?? "",
    req.staff_notes ?? "",
    new Date().toISOString(),
  ];

  const range = `'${tab}'!A:Q`;

  // Ensure the header row exists.
  const head = await fetch(`${GATEWAY}/spreadsheets/${spreadsheetId}/values/'${tab}'!A1:Q1`, {
    headers,
  });
  if (!head.ok) {
    const detail = await head.text();
    throw new Error(`Sheets read failed (${head.status}): ${detail.slice(0, 300)}`);
  }
  const headJson = await head.json();
  if (!headJson.values?.length) {
    await fetch(
      `${GATEWAY}/spreadsheets/${spreadsheetId}/values/'${tab}'!A1:Q1?valueInputOption=RAW`,
      { method: "PUT", headers, body: JSON.stringify({ values: [HEADER] }) },
    );
  }

  // Only reuse the stored row when it belongs to the same spreadsheet.
  if (req.sheet_row && req.sheet_spreadsheet_id === spreadsheetId) {
    const cellRange = `'${tab}'!A${req.sheet_row}:Q${req.sheet_row}`;
    const upd = await fetch(
      `${GATEWAY}/spreadsheets/${spreadsheetId}/values/${cellRange}?valueInputOption=USER_ENTERED`,
      { method: "PUT", headers, body: JSON.stringify({ values: [row] }) },
    );
    if (!upd.ok) {
      const detail = await upd.text();
      throw new Error(`Sheets update failed (${upd.status}): ${detail.slice(0, 300)}`);
    }
    return { sheet_row: req.sheet_row as number, spreadsheet_id: spreadsheetId };
  }

  const app = await fetch(
    `${GATEWAY}/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers, body: JSON.stringify({ values: [row] }) },
  );
  if (!app.ok) {
    const detail = await app.text();
    throw new Error(`Sheets append failed (${app.status}): ${detail.slice(0, 300)}`);
  }
  const appJson = await app.json();
  const updatedRange: string = appJson.updates?.updatedRange ?? "";
  const rowNumber = Number(updatedRange.match(/![A-Z]+(\d+)/)?.[1] ?? 0) || null;
  return { sheet_row: rowNumber, spreadsheet_id: spreadsheetId };

}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    const requestId = body?.requestId;
    if (action !== "generate" && action !== "sync") return json({ error: "Unknown action" }, 400);
    if (typeof requestId !== "string" || !requestId) return json({ error: "requestId is required" }, 400);

    const admin = createClient(url, serviceKey);

    const { data: scriptRequest, error: reqErr } = await admin
      .from("automation_script_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr) return json({ error: reqErr.message }, 500);
    if (!scriptRequest) return json({ error: "Request not found" }, 404);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "editor");
    if (scriptRequest.owner_id !== user.id && !isStaff) return json({ error: "Forbidden" }, 403);

    const { data: flyer } = await admin
      .from("flyers")
      .select("title, category, address, price_cents, beds, baths, sqft, chatbot_knowledge")
      .eq("id", scriptRequest.flyer_id)
      .maybeSingle();

    // PER-PROJECT RULE: only this project's own onboarding may be used.
    // Never fall back to another project or another account's business info.
    const { data: scriptJob } = await admin
      .from("jobs")
      .select("id")
      .eq("flyer_id", scriptRequest.flyer_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: onboarding } = scriptJob?.id
      ? await admin
          .from("onboarding_submissions")
          .select("business_name, business_slogan, business_description, business_address, website_url, facebook_url, instagram_url, tiktok_url, phone, email")
          .eq("flyer_job_id", scriptJob.id)
          .maybeSingle()
      : { data: null };

    let updated = scriptRequest;

    if (action === "generate") {
      const scripts = await generateScripts({
        flyer,
        business: onboarding,
        customer_request: scriptRequest.custom_request,
      });
      const { data, error } = await admin
        .from("automation_script_requests")
        .update({
          facebook_post: scripts.facebook_post,
          instagram_caption: scripts.instagram_caption,
          tiktok_caption: scripts.tiktok_caption,
          email_subject: scripts.email_subject,
          email_body: scripts.email_body,
          sms_body: scripts.sms_body,
          video_script: scripts.video_script,
          status: scriptRequest.status === "requested" ? "drafted" : scriptRequest.status,
        })
        .eq("id", requestId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      updated = data;
    }

    // Always push the latest state to the master sheet.
    let skipped: string | undefined;
    try {
      const result = await syncToSheet(
        admin,
        updated,
        flyer?.title ?? "Flyer",
        onboarding?.email ?? user.email ?? "",
      );
      if ("skipped" in result && result.skipped) {
        skipped = result.skipped;
        await admin
          .from("automation_script_requests")
          .update({ sheet_error: result.skipped })
          .eq("id", requestId);
      } else {
        const { data } = await admin
          .from("automation_script_requests")
          .update({
            sheet_row: (result as any).sheet_row ?? updated.sheet_row,
            sheet_spreadsheet_id: (result as any).spreadsheet_id ?? updated.sheet_spreadsheet_id,
            sheet_synced_at: new Date().toISOString(),
            sheet_error: null,
          })
          .eq("id", requestId)
          .select()
          .single();
        if (data) updated = data;
      }
    } catch (e) {
      const message = (e as Error).message;
      console.error("Sheet sync failed:", message);
      await admin
        .from("automation_script_requests")
        .update({ sheet_error: message })
        .eq("id", requestId);
      skipped = message;
    }

    return json({ request: updated, skipped });
  } catch (e) {
    console.error("automation-scripts error:", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
