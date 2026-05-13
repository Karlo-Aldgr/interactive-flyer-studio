/**
 * Cloudflare Worker — Social share unfurler for FlyerFlow
 * ---------------------------------------------------------
 * Crawler UAs we care about: facebookexternalhit, WhatsApp/2.x, Twitterbot,
 * LinkedInBot, Slackbot, Discordbot, TelegramBot, etc.
 *
 * Routes:
 *   GET /f/:slug   -> Crawler: OG HTML. Human: 302 to live viewer.
 *   GET /         -> 302 to app homepage.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, APP_ORIGIN
 */

const CRAWLER_RE =
  /(facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|pinterest|redditbot|applebot|bingbot|googlebot|embedly|quora|vkshare|w3c_validator|bot|crawler|spider|preview)/i;

// Guaranteed absolute https URL — WhatsApp requires this for og:image.
// Replace with a branded image in flyer-thumbnails bucket if you want.
const FALLBACK_IMAGE = "https://interactive-flyer-studio.lovable.app/og.png";

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
    slug
  )}&status=eq.published&select=id,owner_id,title,public_slug,thumbnail_url&limit=1`;

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

/**
 * Pick the best og:image URL and report which source we used.
 * If `isLanding` is true (share URL has ?page=...), use the landing-page
 * thumbnail (flyers.thumbnail_url). Otherwise (direct flyer link) use the
 * sibling "-flyer.jpg" variant uploaded by the editor.
 */
function pickImage(flyer, env, pageId) {
  const isLanding = !!pageId;
  if (isLanding) {
    // Per-page landing variant uploaded by editor as `${flyerId}-${pageId}-flyer.jpg`.
    if (env.SUPABASE_URL && flyer?.owner_id && flyer?.id) {
      return {
        url: `${env.SUPABASE_URL}/storage/v1/object/public/flyer-thumbnails/${flyer.owner_id}/${flyer.id}-${pageId}-flyer.jpg`,
        source: "landing-page-variant",
      };
    }
    if (flyer?.thumbnail_url) {
      return { url: String(flyer.thumbnail_url).split("?")[0], source: "landing-thumbnail" };
    }
  } else {
    if (env.SUPABASE_URL && flyer?.owner_id && flyer?.id) {
      return {
        url: `${env.SUPABASE_URL}/storage/v1/object/public/flyer-thumbnails/${flyer.owner_id}/${flyer.id}-flyer.jpg`,
        source: "flyer-variant",
      };
    }
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
    const ua = request.headers.get("user-agent") || "";
    const isCrawler = CRAWLER_RE.test(ua);
    const appOrigin = env.APP_ORIGIN || "https://interactive-flyer-studio.lovable.app";

    // Root → app homepage
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(appOrigin, 302);
    }

    // /f/:slug
    const match = url.pathname.match(/^\/f\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) {
      return new Response("Not found", { status: 404 });
    }
    const slug = match[1];
    // Preserve incoming query string so ?page=<id> survives the redirect /
    // OG fetch round-trip.
    const qs = url.search || "";
    const pageId = url.searchParams.get("page");
    const isLanding = !!pageId;
    const viewerUrl = `${appOrigin}/f/${slug}${qs}`;
    // Canonical MUST include the query string, otherwise Facebook re-scrapes
    // the bare slug and overrides our per-page image.
    const shareUrl = `${url.origin}/f/${slug}${qs}`;

    // Humans → straight to the interactive viewer (with original query).
    if (!isCrawler) {
      return Response.redirect(viewerUrl, 302);
    }

    // Crawlers → always serve OG HTML, even if Supabase is down.
    const flyer = await fetchFlyer(env, slug);
    const { url: image, source: imageSource } = pickImage(flyer, env, isLanding);
    const title = flyer?.title || "Flyer";
    const description = isLanding
      ? `View "${title}" — interactive flyer.`
      : `Open "${title}" — tap to interact.`;

    return new Response(ogHtml({ title, description, image, canonical: shareUrl }), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-share-worker": "v4",
        "x-flyer-found": flyer ? "true" : "false",
        "x-image-source": imageSource,
        "x-link-kind": isLanding ? "landing" : "flyer",
      },
    });
  },
};
