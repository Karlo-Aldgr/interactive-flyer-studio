/**
 * Cloudflare Worker — client website subdomains for TapThatFlyer
 * ---------------------------------------------------------------
 * Route:  *.tapthatflyer.com/*
 *
 * Serves ONE published client website per subdomain from the single
 * TapThatFlyer app. The browser URL stays on the subdomain; the request is
 * proxied to the app origin so assets and client routing keep working.
 *
 * Required env vars:
 *   APP_ORIGIN   e.g. https://tapthatflyer.com
 *
 * Deploy:
 *   1. Cloudflare DNS → add a PROXIED record for `*` on tapthatflyer.com
 *      (A 185.158.133.1, or CNAME to tapthatflyer.com).
 *   2. Workers → deploy this script on route `*.tapthatflyer.com/*`.
 *   3. Universal SSL already covers one wildcard level.
 */

const RESERVED = new Set(["www", "app", "api", "preview", "share", "admin", "mail"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const appOrigin = (env.APP_ORIGIN || "https://tapthatflyer.com").replace(/\/$/, "");
    const host = url.hostname.toLowerCase();
    const root = "tapthatflyer.com";

    // TikTok media proxy — streams the original storage object under a
    // TapThatFlyer-owned URL prefix so PULL_FROM_URL passes URL verification.
    // No redirect: bytes are proxied straight through with Range support.
    // TikTok URL-prefix verification files (tiktok<id>.txt) are STATIC assets
    // served by the app origin. They must never be proxied, or TikTok's
    // Production/Sandbox prefix verification breaks. Only signed tokens proxy.
    const tiktokToken = url.pathname.startsWith("/media/tiktok/")
      ? url.pathname.slice("/media/tiktok/".length)
      : "";
    if (tiktokToken && !tiktokToken.endsWith(".txt")) {
      const supabaseUrl = (env.SUPABASE_URL || "https://iwmykqilqywbzxpcgaop.supabase.co")
        .replace(/\/$/, "");
      const target = `${supabaseUrl}/functions/v1/tiktok-media/${tiktokToken}`;
      const headers = new Headers();
      const range = request.headers.get("range");
      if (range) headers.set("range", range);
      const res = await fetch(target, { method: request.method === "HEAD" ? "HEAD" : "GET", headers, redirect: "follow" });
      const out = new Response(res.body, res);
      out.headers.delete("content-security-policy");
      out.headers.delete("x-frame-options");
      return out;
    }

    if (!host.endsWith(`.${root}`)) return fetch(request);
    const sub = host.slice(0, -1 * (root.length + 1));
    if (!sub || sub.includes(".") || RESERVED.has(sub)) return fetch(request);

    // Static assets and any explicit path pass straight through to the app.
    const target = new URL(url.pathname === "/" ? `/site/${sub}` : url.pathname, appOrigin);
    target.search = url.search;

    const upstream = new Request(target.toString(), request);
    upstream.headers.set("x-tapthatflyer-site", sub);
    const res = await fetch(upstream, { redirect: "manual" });

    const out = new Response(res.body, res);
    out.headers.delete("content-security-policy");
    return out;
  },
};
