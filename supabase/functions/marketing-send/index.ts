// Authenticated marketing sending: welcome test emails and campaign sends.
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

const BATCH = 8;
const MAX_RECIPIENTS = 500;

function matches(sub: any, c: any) {
  switch (c?.field) {
    case "status":
      return c.op === "is_not" ? sub.status !== c.value : sub.status === c.value;
    case "source":
      return c.op === "is_not" ? sub.source !== c.value : sub.source === c.value;
    case "tag": {
      const has = (sub.tags ?? []).some(
        (t: string) => String(t).toLowerCase() === String(c.value).toLowerCase(),
      );
      return c.op === "is_not" ? !has : has;
    }
    case "created_after":
      return new Date(sub.created_at) >= new Date(c.value);
    case "created_before":
      return new Date(sub.created_at) <= new Date(c.value);
    default:
      return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: marketingCors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!Deno.env.get("RESEND_API_KEY")?.trim()) {
      return jsonResponse(
        { error: "Email sending is not configured yet (missing RESEND_API_KEY)." },
        503,
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const action = String(body.action || "");
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://tapthatflyer.com";

    /* ------------------------------ test email ------------------------------ */
    if (action === "test_welcome") {
      const to = String(body.to || "").trim().toLowerCase();
      if (!isEmail(to)) return jsonResponse({ error: "Enter a valid test email address" }, 400);

      const clientId: string | null = body.client_id === null ? null : String(body.client_id || user.id);
      if (clientId !== null && clientId !== user.id && !isAdmin) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      if (clientId === null && !isAdmin) return jsonResponse({ error: "Forbidden" }, 403);

      const settings = await loadSettings(supabase, clientId);
      let businessName = settings.business_name;
      if (!businessName && clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", clientId)
          .maybeSingle();
        businessName = profile?.full_name ?? null;
      }
      businessName = businessName || "TapThatFlyer";

      const vars = {
        first_name: "John",
        last_name: "Smith",
        email: to,
        business_name: businessName,
        unsubscribe_link: `${siteUrl}/unsubscribe?token=preview`,
      };
      const subject = renderTemplate(settings.welcome_subject || DEFAULT_WELCOME_SUBJECT, vars);
      const text = renderTemplate(settings.welcome_body || DEFAULT_WELCOME_BODY, vars);
      const result = await sendResendEmail({
        from: defaultFrom(settings.from_name || businessName),
        to,
        subject: `[Test] ${subject}`,
        text,
        html: textToHtml(text, vars.unsubscribe_link),
        replyTo: settings.reply_to,
      });
      await logEmail(supabase, {
        client_id: clientId,
        recipient_email: to,
        email_type: "welcome_test",
        subject,
        status: result.ok ? "sent" : "failed",
        error: result.error ?? null,
      });
      if (!result.ok) return jsonResponse({ error: result.error }, 502);
      return jsonResponse({ ok: true });
    }

    /* ---------------------------- send a campaign --------------------------- */
    if (action === "send_campaign") {
      const campaignId = String(body.campaign_id || "");
      const { data: campaign } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();
      if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);

      const ownsCampaign = campaign.client_id === user.id;
      if (!ownsCampaign && !isAdmin) return jsonResponse({ error: "Forbidden" }, 403);
      if (campaign.client_id === null && !isAdmin) return jsonResponse({ error: "Forbidden" }, 403);
      if (campaign.status === "sent" || campaign.status === "sending") {
        return jsonResponse({ error: "This campaign has already been sent." }, 400);
      }
      if (campaign.channel !== "email") {
        return jsonResponse(
          { error: "Only email campaigns can be sent from here. Use the social publisher for social posts." },
          400,
        );
      }

      await supabase.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);

      // Resolve recipients server-side from the campaign's own scope.
      const rules = campaign.audience_rules ?? { match: "all", conditions: [] };
      const conditions: any[] = Array.isArray(rules.conditions) ? rules.conditions : [];
      const match = rules.match === "any" ? "any" : "all";

      type Recipient = {
        email: string;
        first_name?: string | null;
        last_name?: string | null;
        subscriber_id?: string | null;
        token?: string | null;
        client_id: string | null;
      };
      let recipients: Recipient[] = [];

      if (campaign.client_id === null && isAdmin && (rules as any).target === "clients") {
        // Platform campaign targeting TapThatFlyer clients
        const { data: clients } = await supabase
          .from("profiles")
          .select("id, email, full_name, client_status");
        const filtered = (clients ?? []).filter((c: any) => {
          const clientConds = conditions.filter((x) => x.field === "client_status");
          if (clientConds.length === 0) return true;
          const test = (x: any) =>
            x.op === "is_not" ? c.client_status !== x.value : c.client_status === x.value;
          return match === "all" ? clientConds.every(test) : clientConds.some(test);
        });
        const selected: string[] = Array.isArray((rules as any).client_ids)
          ? (rules as any).client_ids
          : [];
        const finalClients = selected.length ? filtered.filter((c: any) => selected.includes(c.id)) : filtered;
        recipients = finalClients
          .filter((c: any) => c.email && isEmail(c.email))
          .map((c: any) => ({
            email: c.email.toLowerCase(),
            first_name: (c.full_name || "").split(" ")[0] || null,
            last_name: null,
            client_id: null,
          }));
      } else {
        let q = supabase.from("marketing_subscribers").select("*").eq("status", "active").limit(5000);
        q = campaign.client_id ? q.eq("client_id", campaign.client_id) : q.is("client_id", null);
        const { data: subs } = await q;
        const selected: string[] = Array.isArray((rules as any).subscriber_ids)
          ? (rules as any).subscriber_ids
          : [];
        const filtered = (subs ?? []).filter((s: any) =>
          conditions.length === 0
            ? true
            : match === "all"
              ? conditions.every((c) => matches(s, c))
              : conditions.some((c) => matches(s, c)),
        );
        const finalSubs = selected.length ? filtered.filter((s: any) => selected.includes(s.id)) : filtered;
        recipients = finalSubs.map((s: any) => ({
          email: s.email,
          first_name: s.first_name,
          last_name: s.last_name,
          subscriber_id: s.id,
          token: s.unsubscribe_token,
          client_id: s.client_id,
        }));
      }

      if (recipients.length === 0) {
        await supabase
          .from("marketing_campaigns")
          .update({ status: "failed", error: "No recipients matched this audience." })
          .eq("id", campaignId);
        return jsonResponse({ error: "No recipients matched this audience." }, 400);
      }
      if (recipients.length > MAX_RECIPIENTS) recipients = recipients.slice(0, MAX_RECIPIENTS);

      const settings = await loadSettings(supabase, campaign.client_id);
      let businessName = settings.business_name;
      if (!businessName && campaign.client_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", campaign.client_id)
          .maybeSingle();
        businessName = profile?.full_name ?? null;
      }
      businessName = businessName || "TapThatFlyer";
      const from = defaultFrom(settings.from_name || businessName);

      let sent = 0;
      let failed = 0;
      const ctaBlock =
        campaign.cta_text && campaign.cta_url ? `\n\n${campaign.cta_text}: ${campaign.cta_url}` : "";

      for (let i = 0; i < recipients.length; i += BATCH) {
        const slice = recipients.slice(i, i + BATCH);
        const results = await Promise.all(
          slice.map(async (r) => {
            const unsubscribeUrl = r.token ? `${siteUrl}/unsubscribe?token=${r.token}` : undefined;
            const vars = {
              first_name: r.first_name,
              last_name: r.last_name,
              email: r.email,
              business_name: businessName,
              unsubscribe_link: unsubscribeUrl ?? `${siteUrl}/unsubscribe`,
            };
            const subject = renderTemplate(campaign.subject || campaign.name, vars);
            const text = renderTemplate((campaign.body || "") + ctaBlock, vars);
            const res = await sendResendEmail({
              from,
              to: r.email,
              subject,
              text,
              html: textToHtml(text, unsubscribeUrl),
              replyTo: settings.reply_to,
            });
            await logEmail(supabase, {
              client_id: campaign.client_id,
              subscriber_id: r.subscriber_id ?? null,
              campaign_id: campaign.id,
              recipient_email: r.email,
              email_type: "campaign",
              subject,
              status: res.ok ? "sent" : "failed",
              error: res.error ?? null,
            });
            if (res.ok && r.subscriber_id) {
              await supabase.from("marketing_subscriber_events").insert({
                subscriber_id: r.subscriber_id,
                client_id: r.client_id,
                event_type: "campaign_received",
                description: `Campaign sent: ${campaign.name}`,
              });
            }
            return res.ok;
          }),
        );
        for (const ok of results) ok ? sent++ : failed++;
      }

      await supabase
        .from("marketing_campaigns")
        .update({
          status: sent > 0 ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          sent_count: sent,
          failed_count: failed,
          recipient_count: recipients.length,
          error: sent === 0 ? "All sends failed" : null,
        })
        .eq("id", campaignId);

      return jsonResponse({ ok: true, sent, failed, total: recipients.length });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[marketing-send]", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
