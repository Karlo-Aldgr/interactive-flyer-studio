// Authenticated: send SMS to flyer subscribers who have phone numbers (Twilio).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RECIPIENTS = 50;
const BATCH_SIZE = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalize to E.164-ish digits with leading +. */
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : `+${digits}`;
}

async function sendOne(args: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${args.accountSid}/Messages.json`;
  const form = new URLSearchParams({
    To: args.to,
    From: args.from,
    Body: args.body,
  });
  const auth = btoa(`${args.accountSid}:${args.authToken}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  return {
    ok: false,
    error: String(data.message || data.error_message || `Twilio HTTP ${res.status}`),
  };
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
    const message = String(body.message || body.body || "").trim().slice(0, 320);
    const rawPhones = Array.isArray(body.recipient_phones) ? body.recipient_phones : null;

    if (!flyerId) return json({ error: "Missing flyer_id" }, 400);
    if (!message) return json({ error: "Missing message" }, 400);

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER")?.trim();
    if (!accountSid || !authToken || !fromNumber) {
      return json({
        error:
          "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER secrets.",
      }, 503);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: flyer, error: flyerErr } = await supabase
      .from("flyers")
      .select("id, title, owner_id")
      .eq("id", flyerId)
      .maybeSingle();

    if (flyerErr) return json({ error: flyerErr.message }, 500);
    if (!flyer) return json({ error: "Flyer not found" }, 404);

    const isOwner = flyer.owner_id === user.id;
    let canSend = isOwner;
    if (!canSend) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      const { data: isEditor } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "editor",
      });
      canSend = !!isAdmin || !!isEditor;
    }
    if (!canSend) return json({ error: "Forbidden" }, 403);

    const { data: subs, error: subErr } = await supabase
      .from("subscribers")
      .select("phone, unsubscribed_at")
      .eq("flyer_id", flyerId)
      .is("unsubscribed_at", null)
      .not("phone", "is", null)
      .limit(5000);

    if (subErr) return json({ error: subErr.message }, 500);

    const allowed = new Set<string>();
    for (const s of subs || []) {
      const n = normalizePhone(String(s.phone || ""));
      if (n) allowed.add(n);
    }

    let targets: string[] = [];
    if (rawPhones && rawPhones.length > 0) {
      for (const item of rawPhones) {
        const n = normalizePhone(String(item || ""));
        if (n && allowed.has(n)) targets.push(n);
      }
    } else {
      targets = [...allowed];
    }
    targets = [...new Set(targets)];

    if (targets.length === 0) {
      return json({
        error:
          "No matching subscribers with phone numbers. Collect phone on Subscribe, or add phone to the lead.",
      }, 400);
    }
    if (targets.length > MAX_RECIPIENTS) {
      return json({
        error: `Too many recipients (${targets.length}). Max ${MAX_RECIPIENTS} per send.`,
      }, 400);
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const slice = targets.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        slice.map((to) =>
          sendOne({
            accountSid,
            authToken,
            from: fromNumber,
            to,
            body: message,
          }),
        ),
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].ok) sent += 1;
        else {
          failed += 1;
          if (errors.length < 5) {
            errors.push(`${slice[j]}: ${results[j].error || "failed"}`);
          }
        }
      }
    }

    return json({
      ok: failed === 0,
      sent,
      failed,
      total: targets.length,
      errors,
    });
  } catch (err) {
    console.error("[send-subscriber-sms]", err);
    return json({ error: String(err) }, 500);
  }
});
