/**
 * Cloudflare Worker — Social share unfurler for FlyerFlow
 * ---------------------------------------------------------
 * Crawler UAs we care about: facebookexternalhit, WhatsApp/2.x, Twitterbot,
 * LinkedInBot, Slackbot, Discordbot, TelegramBot, etc.
 *
 * Routes:
 *   GET /f/:slug       -> Crawler: OG HTML. Human: 302 to live viewer.
 *   GET /bizads/:slug  -> Crawler: OG HTML for digital business cards.
 *   GET /             -> 302 to app homepage.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, APP_ORIGIN
 */

const CRAWLER_RE =
  /(facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|pinterest|redditbot|applebot|bingbot|googlebot|embedly|quora|vkshare|w3c_validator|bot|crawler|spider|preview)/i;

// Guaranteed absolute https URL — WhatsApp requires this for og:image.
const FALLBACK_IMAGE = "https://tapthatflyer.com/favicon.png";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Try to fetch flyer metadata. Returns null on any failure. */
async function fetchFlyer(env, slug) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.log("[share-worker] missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return null;
  }
  const url = `${env.SUPABASE_URL}/rest/v1/flyers?public_slug=eq.${encodeURIComponent(
    slug,
  )}&status=eq.published&select=id,owner_id,title,public_slug,thumbnail_url,updated_at&limit=1`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!res.ok) {
      console.log(`[share-worker] supabase ${res.status} for slug=${slug}`);
      return null;
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (e) {
    console.log(`[share-worker] fetchFlyer error for slug=${slug}: ${e?.message || e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch enabled bizad row for social previews. */
async function fetchBizad(env, slug) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.log("[share-worker] missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return null;
  }
  const url = `${env.SUPABASE_URL}/rest/v1/bizads?slug=eq.${encodeURIComponent(
    slug,
  )}&enabled=eq.true&select=business_name,about_text,share_image_url,flyer_image_url,logo_url,updated_at&limit=1`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!res.ok) {
      console.log(`[share-worker] supabase bizad ${res.status} for slug=${slug}`);
      return null;
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (e) {
    console.log(`[share-worker] fetchBizad error for slug=${slug}: ${e?.message || e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickBizadImage(bizad) {
  const image =
    bizad?.share_image_url ||
    bizad?.flyer_image_url ||
    bizad?.logo_url ||
    FALLBACK_IMAGE;
  const stamp = encodeURIComponent(String(bizad?.updated_at || Date.now()));
  return `${image}${String(image).includes("?") ? "&" : "?"}v=${stamp}&variant=bizad`;
}

/** Append a stable cache-buster so Facebook re-fetches regenerated storage images. */
function versionedImageUrl(url, flyer, pageId, source) {
  const stamp = encodeURIComponent(String(flyer?.updated_at || flyer?.id || Date.now()));
  const variant = encodeURIComponent(`${source || "image"}${pageId ? `-${pageId}` : ""}`);
  return `${url}${url.includes("?") ? "&" : "?"}v=${stamp}&variant=${variant}`;
}

/** HEAD-probe a URL through the CF edge cache. True for any 2xx; false for 404. */
async function imageExists(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (res.status === 404) return false;
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return !ct || ct.toLowerCase().startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pick the best og:image URL and report which source we used.
 * If `isLanding` is true (share URL has ?page=...), prefer the per-page variant;
 * otherwise prefer the direct-flyer variant. In either case, if the preferred
 * object does not exist (404 or non-image), fall back to flyers.thumbnail_url
 * and finally to FALLBACK_IMAGE so Facebook never receives a broken og:image.
 */
async function pickImage(flyer, env, pageId) {
  const isLanding = !!pageId;
  const cleanThumb = flyer?.thumbnail_url ? String(flyer.thumbnail_url).split("?")[0] : null;

  if (env.SUPABASE_URL && flyer?.owner_id && flyer?.id) {
    const filename = isLanding ? `${flyer.id}-${pageId}-flyer.jpg` : `${flyer.id}-flyer.jpg`;
    const candidate = `${env.SUPABASE_URL}/storage/v1/object/public/flyer-thumbnails/${flyer.owner_id}/${filename}`;
    if (await imageExists(candidate)) {
      const source = isLanding ? "landing-page-variant" : "flyer-variant";
      return {
        url: versionedImageUrl(candidate, flyer, pageId, source),
        source,
      };
    }
    if (cleanThumb) {
      const source = isLanding ? "landing-thumbnail-fallback" : "flyer-thumbnail-fallback";
      return {
        url: versionedImageUrl(cleanThumb, flyer, pageId, source),
        source,
      };
    }
  } else if (cleanThumb) {
    return { url: versionedImageUrl(cleanThumb, flyer, pageId, "thumbnail-only"), source: "thumbnail-only" };
  }

  return { url: FALLBACK_IMAGE, source: "fallback" };
}

function ogHtml({ title, description, image, canonical }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const i = escapeHtml(image);
  const c = escapeHtml(canonical);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${c}" />

<meta property="og:type" content="website" />
<meta property="og:url" content="${c}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${i}" />
<meta property="og:image:secure_url" content="${i}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
</head>
<body>
<p><a href="${escapeHtml(c)}">${t}</a></p>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    const ua = request.headers.get("user-agent") || "";
    const isCrawler = CRAWLER_RE.test(ua);
    const appOrigin = env.APP_ORIGIN || "https://interactive-flyer-studio.lovable.app";

    // Root → app homepage
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(appOrigin, 302);
    }

    // /f/:slug
    const flyerMatch = url.pathname.match(/^\/f\/([A-Za-z0-9_-]+)\/?$/);
    if (flyerMatch) {
      const slug = flyerMatch[1];
      const qs = url.search || "";
      const pageId = url.searchParams.get("page");
      const isLanding = !!pageId;
      const viewerUrl = `${appOrigin}/f/${slug}${qs}`;
      const shareUrl = `${url.origin}/f/${slug}${qs}`;

      if (!isCrawler) {
        return Response.redirect(viewerUrl, 302);
      }

      const flyer = await fetchFlyer(env, slug);
      const { url: image, source: imageSource } = await pickImage(flyer, env, pageId);
      const title = flyer?.title || "Flyer";
      const description = isLanding ? `View "${title}" — interactive flyer.` : `Open "${title}" — tap to interact.`;

      return new Response(ogHtml({ title, description, image, canonical: shareUrl }), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-share-worker": "v7",
          "x-flyer-found": flyer ? "true" : "false",
          "x-image-source": imageSource,
          "x-link-kind": isLanding ? "landing" : "flyer",
        },
      });
    }

    // /bizads/:slug
    const bizadMatch = url.pathname.match(/^\/bizads\/([A-Za-z0-9_-]+)\/?$/);
    if (bizadMatch) {
      const slug = bizadMatch[1];
      const viewerUrl = `${appOrigin}/bizads/${slug}`;
      const shareUrl = `${url.origin}/bizads/${slug}`;

      if (!isCrawler) {
        return Response.redirect(viewerUrl, 302);
      }

      const bizad = await fetchBizad(env, slug);
      const image = pickBizadImage(bizad);
      const title = bizad?.business_name ? `${bizad.business_name} — Digital Card` : "Digital Business Card";
      const description =
        bizad?.about_text?.trim() ||
        `${bizad?.business_name || "Business"} — digital business card on TapThatFlyer.`;

      return new Response(ogHtml({ title, description, image, canonical: shareUrl }), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-share-worker": "v7",
          "x-bizad-found": bizad ? "true" : "false",
          "x-link-kind": "bizad",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
