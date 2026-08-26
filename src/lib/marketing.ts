import { supabase } from "@/integrations/supabase/client";

/* ---------------------------------- types --------------------------------- */

export type SubscriberStatus = "active" | "unsubscribed";

export type MarketingSubscriber = {
  id: string;
  client_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: SubscriberStatus;
  source: string;
  flyer_id: string | null;
  flyer_name: string | null;
  signup_location: string | null;
  tags: string[];
  notes: string | null;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingSettings = {
  id?: string;
  client_id: string | null;
  business_name: string | null;
  from_name: string | null;
  reply_to: string | null;
  welcome_enabled: boolean;
  welcome_subject: string;
  welcome_body: string;
};

export type AudienceScope = "subscriber" | "client";

export type AudienceCondition = {
  field: "status" | "tag" | "source" | "created_after" | "created_before" | "client_status";
  op: "is" | "is_not" | "contains";
  value: string;
};

export type AudienceRules = {
  match: "all" | "any";
  conditions: AudienceCondition[];
};

export type MarketingAudience = {
  id: string;
  client_id: string | null;
  scope: AudienceScope;
  name: string;
  description: string | null;
  rules: AudienceRules;
  created_at: string;
};

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled"
  | "archived";

export type MarketingCampaign = {
  id: string;
  client_id: string | null;
  name: string;
  campaign_type: string;
  channel: string;
  audience_id: string | null;
  audience_label: string | null;
  audience_rules: AudienceRules | Record<string, unknown>;
  recipient_count: number;
  subject: string | null;
  body: string | null;
  media_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
};

export const SUBSCRIBER_SOURCES = [
  "website",
  "interactive_flyer",
  "landing_page",
  "qr_code",
  "manual",
  "import",
  "other",
] as const;

export const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  interactive_flyer: "Interactive Flyer",
  landing_page: "Landing Page",
  qr_code: "QR Code",
  manual: "Manual",
  import: "Import",
  other: "Other",
  platform_newsletter: "TapThatFlyer Newsletter",
};

export const CAMPAIGN_TYPES = ["announcement", "newsletter", "promotion", "social_post", "other"];

export const EMPTY_RULES: AudienceRules = { match: "all", conditions: [] };

export const DEFAULT_WELCOME_SUBJECT = "Welcome to {{business_name}}!";
export const DEFAULT_WELCOME_BODY = `Hi {{first_name}},

Thanks for subscribing to {{business_name}}.

We'll keep you updated with our latest news, offers, announcements, and useful updates.

We look forward to keeping in touch.

{{business_name}}`;

export const PERSONALIZATION_VARS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{email}}",
  "{{business_name}}",
  "{{unsubscribe_link}}",
];

/* ------------------------------ subscribers ------------------------------- */

export type SubscriberFilters = {
  clientId?: string | null; // undefined = no client filter (admin, all clients)
  search?: string;
  status?: string;
  source?: string;
  tag?: string;
  from?: string;
  to?: string;
};

export async function fetchSubscribers(filters: SubscriberFilters) {
  let q = supabase
    .from("marketing_subscribers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (filters.clientId !== undefined) {
    if (filters.clientId === null) q = q.is("client_id", null);
    else q = q.eq("client_id", filters.clientId);
  }
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.source && filters.source !== "all") q = q.eq("source", filters.source);
  if (filters.tag && filters.tag !== "all") q = q.contains("tags", [filters.tag]);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.search?.trim()) {
    const s = filters.search.trim().replace(/[%,]/g, "");
    q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingSubscriber[];
}

export function subscriberStats(rows: MarketingSubscriber[]) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    unsubscribed: rows.filter((r) => r.status === "unsubscribed").length,
    newThisMonth: rows.filter((r) => new Date(r.created_at) >= monthStart).length,
  };
}

export async function saveSubscriber(
  payload: Partial<MarketingSubscriber> & { client_id: string | null; email: string },
) {
  const email = payload.email.trim().toLowerCase();
  if (payload.id) {
    const { error } = await supabase
      .from("marketing_subscribers")
      .update({ ...payload, email })
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
    return payload.id;
  }
  const { data, error } = await supabase
    .from("marketing_subscribers")
    .insert({ ...payload, email })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("This email is already on your list.");
    throw new Error(error.message);
  }
  await logSubscriberEvent(data.id, payload.client_id, "subscribed", "Added to list");
  return data.id as string;
}

export async function setSubscriberStatus(
  subscriber: MarketingSubscriber,
  status: SubscriberStatus,
) {
  const { error } = await supabase
    .from("marketing_subscribers")
    .update({
      status,
      unsubscribed_at: status === "unsubscribed" ? new Date().toISOString() : null,
    })
    .eq("id", subscriber.id);
  if (error) throw new Error(error.message);
  await logSubscriberEvent(
    subscriber.id,
    subscriber.client_id,
    status === "unsubscribed" ? "unsubscribed" : "resubscribed",
    status === "unsubscribed" ? "Unsubscribed" : "Re-subscribed",
  );
}

export async function deleteSubscriber(id: string) {
  const { error } = await supabase.from("marketing_subscribers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function logSubscriberEvent(
  subscriberId: string,
  clientId: string | null,
  eventType: string,
  description: string,
) {
  await supabase.from("marketing_subscriber_events").insert({
    subscriber_id: subscriberId,
    client_id: clientId,
    event_type: eventType,
    description,
  });
}

export async function fetchSubscriberEvents(subscriberId: string) {
  const { data, error } = await supabase
    .from("marketing_subscriber_events")
    .select("*")
    .eq("subscriber_id", subscriberId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchEmailLog(clientId: string | null | undefined, subscriberId?: string) {
  let q = supabase
    .from("marketing_email_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (clientId !== undefined) {
    if (clientId === null) q = q.is("client_id", null);
    else q = q.eq("client_id", clientId);
  }
  if (subscriberId) q = q.eq("subscriber_id", subscriberId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/* ---------------------------------- tags ---------------------------------- */

export async function fetchTags(clientId: string | null | undefined) {
  let q = supabase.from("marketing_tags").select("*").order("name");
  if (clientId !== undefined) {
    if (clientId === null) q = q.is("client_id", null);
    else q = q.eq("client_id", clientId);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; client_id: string | null; name: string }[];
}

export async function createTag(clientId: string | null, name: string) {
  const { error } = await supabase
    .from("marketing_tags")
    .insert({ client_id: clientId, name: name.trim() });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function deleteTag(id: string) {
  const { error } = await supabase.from("marketing_tags").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* -------------------------------- settings -------------------------------- */

export async function fetchSettings(clientId: string | null): Promise<MarketingSettings> {
  let q = supabase.from("marketing_settings").select("*").limit(1);
  q = clientId === null ? q.is("client_id", null) : q.eq("client_id", clientId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as MarketingSettings;
  return {
    client_id: clientId,
    business_name: null,
    from_name: null,
    reply_to: null,
    welcome_enabled: true,
    welcome_subject: DEFAULT_WELCOME_SUBJECT,
    welcome_body: DEFAULT_WELCOME_BODY,
  };
}

export async function saveSettings(settings: MarketingSettings) {
  if (settings.id) {
    const { error } = await supabase
      .from("marketing_settings")
      .update({
        business_name: settings.business_name,
        from_name: settings.from_name,
        reply_to: settings.reply_to,
        welcome_enabled: settings.welcome_enabled,
        welcome_subject: settings.welcome_subject,
        welcome_body: settings.welcome_body,
      })
      .eq("id", settings.id);
    if (error) throw new Error(error.message);
    return settings.id;
  }
  const { data, error } = await supabase
    .from("marketing_settings")
    .insert({
      client_id: settings.client_id,
      business_name: settings.business_name,
      from_name: settings.from_name,
      reply_to: settings.reply_to,
      welcome_enabled: settings.welcome_enabled,
      welcome_subject: settings.welcome_subject,
      welcome_body: settings.welcome_body,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/* ------------------------------- audiences -------------------------------- */

export async function fetchAudiences(clientId: string | null | undefined, scope?: AudienceScope) {
  let q = supabase.from("marketing_audiences").select("*").order("created_at", { ascending: false });
  if (clientId !== undefined) {
    if (clientId === null) q = q.is("client_id", null);
    else q = q.eq("client_id", clientId);
  }
  if (scope) q = q.eq("scope", scope);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingAudience[];
}

export async function saveAudience(a: Partial<MarketingAudience> & { name: string }) {
  const payload = {
    client_id: a.client_id ?? null,
    scope: a.scope ?? "subscriber",
    name: a.name.trim(),
    description: a.description ?? null,
    rules: a.rules ?? EMPTY_RULES,
  };
  if (a.id) {
    const { error } = await supabase.from("marketing_audiences").update(payload).eq("id", a.id);
    if (error) throw new Error(error.message);
    return a.id;
  }
  const { data, error } = await supabase
    .from("marketing_audiences")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteAudience(id: string) {
  const { error } = await supabase.from("marketing_audiences").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function matchesCondition(sub: MarketingSubscriber, c: AudienceCondition): boolean {
  switch (c.field) {
    case "status":
      return c.op === "is_not" ? sub.status !== c.value : sub.status === c.value;
    case "source":
      return c.op === "is_not" ? sub.source !== c.value : sub.source === c.value;
    case "tag": {
      const has = (sub.tags ?? []).some((t) => t.toLowerCase() === c.value.toLowerCase());
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

/** Evaluate subscriber audience rules locally against an already RLS-scoped list. */
export function evaluateSubscriberRules(
  rows: MarketingSubscriber[],
  rules: AudienceRules | undefined | null,
) {
  const conditions = rules?.conditions ?? [];
  if (conditions.length === 0) return rows;
  const match = rules?.match ?? "all";
  return rows.filter((row) =>
    match === "all"
      ? conditions.every((c) => matchesCondition(row, c))
      : conditions.some((c) => matchesCondition(row, c)),
  );
}

export type MarketingClient = {
  id: string;
  email: string | null;
  full_name: string | null;
  client_status: string;
  subscriber_count: number;
};

export async function fetchMarketingClients(): Promise<MarketingClient[]> {
  const { data, error } = await supabase.rpc("marketing_list_clients");
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingClient[];
}

export function evaluateClientRules(
  clients: MarketingClient[],
  rules: AudienceRules | undefined | null,
) {
  const conditions = (rules?.conditions ?? []).filter((c) => c.field === "client_status");
  if (conditions.length === 0) return clients;
  const match = rules?.match ?? "all";
  const test = (c: AudienceCondition, cl: MarketingClient) =>
    c.op === "is_not" ? cl.client_status !== c.value : cl.client_status === c.value;
  return clients.filter((cl) =>
    match === "all" ? conditions.every((c) => test(c, cl)) : conditions.some((c) => test(c, cl)),
  );
}

/* -------------------------------- campaigns ------------------------------- */

export async function fetchCampaigns(clientId: string | null | undefined) {
  let q = supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (clientId !== undefined) {
    if (clientId === null) q = q.is("client_id", null);
    else q = q.eq("client_id", clientId);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingCampaign[];
}

export async function saveCampaign(c: Partial<MarketingCampaign> & { name: string }) {
  const payload = {
    client_id: c.client_id ?? null,
    name: c.name.trim(),
    campaign_type: c.campaign_type ?? "newsletter",
    channel: c.channel ?? "email",
    audience_id: c.audience_id ?? null,
    audience_label: c.audience_label ?? null,
    audience_rules: c.audience_rules ?? EMPTY_RULES,
    recipient_count: c.recipient_count ?? 0,
    subject: c.subject ?? null,
    body: c.body ?? null,
    media_url: c.media_url ?? null,
    cta_text: c.cta_text ?? null,
    cta_url: c.cta_url ?? null,
    status: c.status ?? "draft",
    scheduled_at: c.scheduled_at ?? null,
  };
  if (c.id) {
    const { error } = await supabase.from("marketing_campaigns").update(payload).eq("id", c.id);
    if (error) throw new Error(error.message);
    return c.id;
  }
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setCampaignStatus(id: string, status: CampaignStatus) {
  const { error } = await supabase.from("marketing_campaigns").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* --------------------------------- export --------------------------------- */

export function subscribersToCsv(rows: MarketingSubscriber[]) {
  const header = [
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Status",
    "Source",
    "Tags",
    "Flyer",
    "Date Added",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.first_name,
      r.last_name,
      r.email,
      r.phone,
      r.status,
      SOURCE_LABELS[r.source] ?? r.source,
      (r.tags ?? []).join("|"),
      r.flyer_name,
      new Date(r.created_at).toISOString().slice(0, 10),
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ParsedImportRow = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  tags: string[];
};

export function parseSubscriberCsv(text: string): { rows: ParsedImportRow[]; invalid: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], invalid: 0 };

  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === "," && !quoted) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iFirst = idx("firstname", "first");
  const iLast = idx("lastname", "last");
  const iEmail = idx("email", "emailaddress");
  const iPhone = idx("phone", "phonenumber", "mobile");
  const iTags = idx("tags", "tag");

  if (iEmail === -1) return { rows: [], invalid: 0 };

  const rows: ParsedImportRow[] = [];
  let invalid = 0;
  for (const line of lines.slice(1)) {
    const cols = splitLine(line);
    const email = (cols[iEmail] ?? "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid++;
      continue;
    }
    rows.push({
      first_name: iFirst >= 0 ? cols[iFirst] ?? "" : "",
      last_name: iLast >= 0 ? cols[iLast] ?? "" : "",
      email,
      phone: iPhone >= 0 ? cols[iPhone] ?? "" : "",
      tags:
        iTags >= 0 && cols[iTags]
          ? cols[iTags]
              .split(/[|;]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
    });
  }
  return { rows, invalid };
}

/* ------------------------------ personalization --------------------------- */

export function renderTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const value = vars[key.toLowerCase()];
    if (value && value.trim()) return value;
    if (key.toLowerCase() === "first_name") return "there";
    if (key.toLowerCase() === "business_name") return "us";
    return "";
  });
}
