// Public newsletter signup + unsubscribe. Native replacement for the Make.com webhook.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  DEFAULT_WELCOME_BODY,
  DEFAULT_WELCOME_SUBJECT,
  defaultFrom,
  isEmail,
  jsonResponse,
  loadSettings,
  logEmail,
  marketingCors,
  renderTemplate,
  sendResendEmail,
  textToHtml,
} from "../_shared/marketingMail.ts";

const ALLOWED_SOURCES = new Set([
  "website",
  "interactive_flyer",
  "landing_page",
  "qr_code",
  "manual",
  "import",
  "other",
  "platform_newsletter",
]);

// naive in-memory rate limiting per isolate
const hits = new Map<string, number[]>();
function rateLimited(key: string, max = 8, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: marketingCors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const action = String(body.action || "subscribe");

    /* ------------------------------ unsubscribe ----------------------------- */
    if (action === "unsubscribe") {
      const token = String(body.token || "").trim();
      if (!token) return jsonResponse({ error: "Missing token" }, 400);
      const { data: sub } = await supabase
        .from("marketing_subscribers")
        .select("id, client_id, status")
        .eq("unsubscribe_token", token)
        .maybeSingle();
      if (!sub) return jsonResponse({ error: "Unknown unsubscribe link" }, 404);
      if (sub.status !== "unsubscribed") {
        await supabase
          .from("marketing_subscribers")
          .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
          .eq("id", sub.id);
        await supabase.from("marketing_subscriber_events").insert({
          subscriber_id: sub.id,
          client_id: sub.client_id,
          event_type: "unsubscribed",
          description: "Unsubscribed via email link",
        });
      }
      return jsonResponse({ ok: true });
    }

    /* ------------------------------- subscribe ------------------------------ */
    const email = String(body.email || "").trim().toLowerCase();
    if (!isEmail(email)) return jsonResponse({ error: "Please enter a valid email address." }, 400);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) return jsonResponse({ error: "Too many requests. Try again shortly." }, 429);

    const firstName = String(body.first_name || "").trim().slice(0, 80) || null;
    const lastName = String(body.last_name || "").trim().slice(0, 80) || null;
    const phone = String(body.phone || "").trim().slice(0, 40) || null;
    const signupLocation = String(body.signup_location || "").trim().slice(0, 200) || null;
    let source = String(body.source || "website");
    if (!ALLOWED_SOURCES.has(source)) source = "other";

    // Client ownership is derived from trusted server-side lookups only.
    let clientId: string | null = null;
    let flyerId: string | null = null;
    let flyerName: string | null = null;

    const flyerRef = String(body.flyer_id || "").trim();
    const flyerSlug = String(body.flyer_slug || body.website_slug || "").trim();

    if (flyerRef || flyerSlug) {
      let q = supabase.from("flyers").select("id, title, owner_id, public_slug, website_slug");
      q = flyerRef ? q.eq("id", flyerRef) : q.or(`public_slug.eq.${flyerSlug},website_slug.eq.${flyerSlug}`);
      const { data: flyer } = await q.limit(1).maybeSingle();
      if (flyer) {
        clientId = flyer.owner_id;
        flyerId = flyer.id;
        flyerName = flyer.title;
      }
    }

    if (!clientId && source === "platform_newsletter") source = "platform_newsletter";

    const clientFilter = clientId ? { client_id: clientId } : {};
    let existingQuery = supabase
      .from("marketing_subscribers")
      .select("*")
      .ilike("email", email)
      .limit(1);
    existingQuery = clientId
      ? existingQuery.eq("client_id", clientId)
      : existingQuery.is("client_id", null);
    const { data: existing } = await existingQuery.maybeSingle();

    let subscriberId: string;
    let isNew = false;

    if (existing) {
      subscriberId = existing.id;
      const wasUnsubscribed = existing.status === "unsubscribed";
      await supabase
        .from("marketing_subscribers")
        .update({
          status: "active",
          unsubscribed_at: null,
          first_name: firstName ?? existing.first_name,
          last_name: lastName ?? existing.last_name,
          phone: phone ?? existing.phone,
          flyer_id: flyerId ?? existing.flyer_id,
          flyer_name: flyerName ?? existing.flyer_name,
          signup_location: signupLocation ?? existing.signup_location,
        })
        .eq("id", existing.id);
      if (wasUnsubscribed) {
        isNew = true;
        await supabase.from("marketing_subscriber_events").insert({
          subscriber_id: subscriberId,
          client_id: clientId,
          event_type: "resubscribed",
          description: `Re-subscribed via ${source}`,
        });
      }
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("marketing_subscribers")
        .insert({
          ...clientFilter,
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          status: "active",
          source,
          flyer_id: flyerId,
          flyer_name: flyerName,
          signup_location: signupLocation,
        })
        .select("id")
        .single();
      if (insertErr) return jsonResponse({ error: insertErr.message }, 500);
      subscriberId = inserted.id;
      isNew = true;
      await supabase.from("marketing_subscriber_events").insert({
        subscriber_id: subscriberId,
        client_id: clientId,
        event_type: "subscribed",
        description: `Subscribed via ${source}`,
      });
    }

    /* ---------------------------- welcome email ----------------------------- */
    let welcomeSent = false;
    if (isNew) {
      const settings = await loadSettings(supabase, clientId);
      if (settings.welcome_enabled) {
        let businessName = settings.business_name;
        if (!businessName && clientId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", clientId)
            .maybeSingle();
          businessName = profile?.full_name ?? null;
        }
        if (!businessName) businessName = "TapThatFlyer";

        const { data: sub } = await supabase
          .from("marketing_subscribers")
          .select("unsubscribe_token")
          .eq("id", subscriberId)
          .maybeSingle();
        const siteUrl = Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://tapthatflyer.com";
        const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${sub?.unsubscribe_token ?? ""}`;

        const vars = {
          first_name: firstName,
          last_name: lastName,
          email,
          business_name: businessName,
          unsubscribe_link: unsubscribeUrl,
        };
        const subject = renderTemplate(settings.welcome_subject || DEFAULT_WELCOME_SUBJECT, vars);
        const text = renderTemplate(settings.welcome_body || DEFAULT_WELCOME_BODY, vars);
        const result = await sendResendEmail({
          from: defaultFrom(settings.from_name || businessName),
          to: email,
          subject,
          text,
          html: textToHtml(text, unsubscribeUrl),
          replyTo: settings.reply_to,
        });
        welcomeSent = result.ok;
        await logEmail(supabase, {
          client_id: clientId,
          subscriber_id: subscriberId,
          recipient_email: email,
          email_type: "welcome",
          subject,
          status: result.ok ? "sent" : "failed",
          error: result.error ?? null,
        });
        if (result.ok) {
          await supabase.from("marketing_subscriber_events").insert({
            subscriber_id: subscriberId,
            client_id: clientId,
            event_type: "welcome_email_sent",
            description: `Welcome email sent: ${subject}`,
          });
        }
      }
    }

    return jsonResponse({ ok: true, subscriber_id: subscriberId, new: isNew, welcome_sent: welcomeSent });
  } catch (err) {
    console.error("[marketing-subscribe]", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
