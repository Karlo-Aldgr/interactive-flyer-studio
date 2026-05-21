/**
 * Classify a flyer view's origin into a friendly brand name
 * (Facebook, Instagram, TikTok, WhatsApp, iMessage, Google, Direct, …).
 *
 * Priority:
 *   1. UTM source (set by share links / ad campaigns)
 *   2. document.referrer host
 *   3. "Direct"
 *
 * Used at write time in PublicViewer and at read time in analytics views
 * (so historical events with only a `referrer` still get classified).
 */

const HOST_MAP: Record<string, string> = {
  fb: "Facebook", facebook: "Facebook",
  "facebook.com": "Facebook", "m.facebook.com": "Facebook", "l.facebook.com": "Facebook", "lm.facebook.com": "Facebook",
  ig: "Instagram", instagram: "Instagram",
  "instagram.com": "Instagram", "l.instagram.com": "Instagram",
  tiktok: "TikTok", "tiktok.com": "TikTok", "www.tiktok.com": "TikTok",
  x: "X / Twitter", twitter: "X / Twitter",
  "twitter.com": "X / Twitter", "x.com": "X / Twitter", "t.co": "X / Twitter",
  youtube: "YouTube", "youtube.com": "YouTube", "m.youtube.com": "YouTube", "youtu.be": "YouTube",
  linkedin: "LinkedIn", "linkedin.com": "LinkedIn", "lnkd.in": "LinkedIn",
  snapchat: "Snapchat", "snapchat.com": "Snapchat",
  pinterest: "Pinterest", "pinterest.com": "Pinterest", "pin.it": "Pinterest",
  reddit: "Reddit", "reddit.com": "Reddit", "old.reddit.com": "Reddit", "out.reddit.com": "Reddit",
  whatsapp: "WhatsApp", "whatsapp.com": "WhatsApp", "wa.me": "WhatsApp",
  messenger: "Messenger", "m.me": "Messenger",
  telegram: "Telegram", "t.me": "Telegram",
  discord: "Discord", "discord.com": "Discord",
  imessage: "iMessage", sms: "SMS",
  email: "Email", mail: "Email",
  "mail.google.com": "Email", "outlook.live.com": "Email", "outlook.office.com": "Email", "mail.yahoo.com": "Email",
  google: "Google", "google.com": "Google", "www.google.com": "Google",
  bing: "Bing", "bing.com": "Bing", "www.bing.com": "Bing",
  duckduckgo: "DuckDuckGo", "duckduckgo.com": "DuckDuckGo",
  yahoo: "Yahoo", "search.yahoo.com": "Yahoo",
};

export function classifyTrafficSource(opts: {
  utmSource?: string | null;
  referrer?: string | null;
}): string {
  const utm = (opts.utmSource || "").toLowerCase().trim();
  if (utm) {
    if (HOST_MAP[utm]) return HOST_MAP[utm];
    return utm.charAt(0).toUpperCase() + utm.slice(1);
  }
  const ref = opts.referrer || "";
  if (!ref) return "Direct";
  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (HOST_MAP[host]) return HOST_MAP[host];
    for (const key of Object.keys(HOST_MAP)) {
      if (key.includes(".") && host.endsWith(key)) return HOST_MAP[key];
    }
    return host.replace(/^www\./, "");
  } catch {
    return "Direct";
  }
}

/** Browser-only helper: read UTM + referrer from the current page. */
export function getCurrentTrafficSource(): {
  source: string;
  referrer: string | null;
  utm: Record<string, string>;
} {
  const utm: Record<string, string> = {};
  let referrer: string | null = null;
  try {
    referrer = (typeof document !== "undefined" && document.referrer) || null;
    const params = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = params.get(k);
      if (v) utm[k] = v.slice(0, 80);
    }
  } catch {}
  const source = classifyTrafficSource({ utmSource: utm.utm_source, referrer });
  return { source, referrer, utm };
}

/** Classify an `analytics_events.metadata` JSON blob. */
export function sourceFromEventMetadata(metadata: any): string {
  if (!metadata) return "Direct";
  if (typeof metadata.source === "string" && metadata.source) return metadata.source;
  const utmSource = metadata.utm?.utm_source || metadata.utm_source;
  return classifyTrafficSource({ utmSource, referrer: metadata.referrer });
}
