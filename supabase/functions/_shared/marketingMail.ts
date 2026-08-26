// Shared marketing email helpers (Resend transactional sending + logging).
// deno-lint-ignore-file no-explicit-any

export const marketingCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...marketingCors, "Content-Type": "application/json" },
  });
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function renderTemplate(template: string, vars: Record<string, string | null | undefined>) {
  return String(template ?? "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const value = vars[key.toLowerCase()];
    if (value && String(value).trim()) return String(value);
    if (key.toLowerCase() === "first_name") return "there";
    if (key.toLowerCase() === "business_name") return "us";
    return "";
  });
}

export function textToHtml(text: string, unsubscribeUrl?: string) {
  const escaped = String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const footer = unsubscribeUrl
    ? `<p style="margin:32px 0 0;font-size:12px;color:#5a6a80">
         <a href="${unsubscribeUrl}" style="color:#5a6a80">Unsubscribe</a>
       </p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a1f44">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:32px">
      ${paragraphs}${footer}
    </div></body></html>`;
}

export async function sendResendEmail(args: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: false, error: String(data.message || data.error || `Resend HTTP ${res.status}`) };
}

export function defaultFrom(fromName?: string | null) {
  const configured = Deno.env.get("RESEND_FROM_EMAIL")?.trim();
  if (configured && !fromName) return configured;
  const address = configured?.match(/<([^>]+)>/)?.[1] ?? configured ?? "onboarding@resend.dev";
  return `${(fromName || "TapThatFlyer").replace(/[<>]/g, "")} <${address}>`;
}

export const DEFAULT_WELCOME_SUBJECT = "Welcome to {{business_name}}!";
export const DEFAULT_WELCOME_BODY = `Hi {{first_name}},

Thanks for subscribing to {{business_name}}.

We'll keep you updated with our latest news, offers, announcements, and useful updates.

We look forward to keeping in touch.

{{business_name}}`;

/** Loads (or falls back to) a client's marketing settings. */
export async function loadSettings(supabase: any, clientId: string | null) {
  const query = supabase.from("marketing_settings").select("*").limit(1);
  const { data } = clientId
    ? await query.eq("client_id", clientId).maybeSingle()
    : await query.is("client_id", null).maybeSingle();
  return (
    data ?? {
      client_id: clientId,
      business_name: null,
      from_name: null,
      reply_to: null,
      welcome_enabled: true,
      welcome_subject: DEFAULT_WELCOME_SUBJECT,
      welcome_body: DEFAULT_WELCOME_BODY,
    }
  );
}

export async function logEmail(
  supabase: any,
  row: {
    client_id: string | null;
    subscriber_id?: string | null;
    campaign_id?: string | null;
    recipient_email: string;
    email_type: string;
    subject: string;
    status: "queued" | "sent" | "failed";
    error?: string | null;
  },
) {
  await supabase.from("marketing_email_log").insert({
    ...row,
    sent_at: row.status === "sent" ? new Date().toISOString() : null,
  });
}
