// Authenticated: send plain-text email to flyer subscribers via Resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RECIPIENTS = 100;
const BATCH_SIZE = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function sendOne(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  const msg = data.message || data.error || `Resend HTTP ${res.status}`;
  return { ok: false, error: String(msg) };
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
    const subject = String(body.subject || "").trim().slice(0, 250);
    const text = String(body.body || body.text || "").trim().slice(0, 8000);
    const rawEmails = Array.isArray(body.recipient_emails) ? body.recipient_emails : null;

    if (!flyerId) return json({ error: "Missing flyer_id" }, 400);
    if (!subject) return json({ error: "Missing subject" }, 400);
    if (!text) return json({ error: "Missing body" }, 400);

    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    if (!resendKey) {
      return json({
        error: "RESEND_API_KEY is not configured. Add it in Lovable/Supabase secrets.",
      }, 503);
    }

    const from =
      Deno.env.get("RESEND_FROM_EMAIL")?.trim() ||
      "TapThatFlyer <onboarding@resend.dev>";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: flyer, error: flyerErr } = await supabase
      .from("flyers")
      .select("id, title, owner_id, status")
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

    // Load active subscribers for this flyer
    const { data: subs, error: subErr } = await supabase
      .from("subscribers")
      .select("email, name, unsubscribed_at")
      .eq("flyer_id", flyerId)
      .is("unsubscribed_at", null)
      .limit(5000);

    if (subErr) return json({ error: subErr.message }, 500);

    const allowed = new Set(
      (subs || [])
        .map((s) => String(s.email || "").trim().toLowerCase())
        .filter((e) => isEmail(e)),
    );

    let targets: string[] = [];
    if (rawEmails && rawEmails.length > 0) {
      for (const item of rawEmails) {
        const e = String(item || "").trim().toLowerCase();
        if (isEmail(e) && allowed.has(e)) targets.push(e);
      }
    } else {
      targets = [...allowed];
    }

    // Dedupe
    targets = [...new Set(targets)];

    if (targets.length === 0) {
      return json({ error: "No matching active subscribers to email" }, 400);
    }
    if (targets.length > MAX_RECIPIENTS) {
      return json({
        error: `Too many recipients (${targets.length}). Max ${MAX_RECIPIENTS} per send — select fewer or send in batches.`,
      }, 400);
    }

    // Prefer owner email as reply-to when available
    let replyTo: string | undefined;
    try {
      const { data: ownerProfile } = await supabase.auth.admin.getUserById(flyer.owner_id);
      replyTo = ownerProfile?.user?.email?.trim() || undefined;
    } catch {
      replyTo = undefined;
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const slice = targets.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        slice.map((to) =>
          sendOne({
            apiKey: resendKey,
            from,
            to,
            subject,
            text,
            replyTo,
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
      from,
      errors,
    });
  } catch (err) {
    console.error("[send-subscriber-email]", err);
    return json({ error: String(err) }, 500);
  }
});
