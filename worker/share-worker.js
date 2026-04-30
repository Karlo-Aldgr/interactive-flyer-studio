/**
 * Cloudflare Worker — Social share unfurler for FlyerFlow
 * ---------------------------------------------------------
 * Why this exists:
 *   Lovable's static hosting can't render per-flyer OG tags (no SSR), and
 *   Supabase Edge Functions inject `Content-Security-Policy: sandbox`, which
 *   makes Facebook/Messenger ignore any OG tags they return. This Worker is
 *   a real server in front of the app: clean HTML, no sandbox, full OG tags.
 *
 * Routes:
 *   GET /f/:slug   -> If crawler: serve OG HTML for that flyer.
 *                     If human:   302 redirect to the live Lovable viewer.
 *   GET /         -> 302 redirect to the app homepage.
 *   GET anything  -> 404.
 *
 * Required environment variables (set in Cloudflare dashboard → Worker → Settings → Variables):
 *   SUPABASE_URL          e.g. https://iwmykqilqywbzxpcgaop.supabase.co
 *   SUPABASE_ANON_KEY     the project's anon/publishable key (safe to expose)
 *   APP_ORIGIN            e.g. https://interactive-flyer-studio.lovable.app
 *
 * Deploy:
 *   1. Create a Worker in the Cloudflare dashboard.
 *   2. Paste this file's contents as the Worker code.
 *   3. Add the three env vars above (as plain text — anon key is publishable).
 *   4. Deploy. Use the *.workers.dev URL or bind a custom subdomain.
 */

const CRAWLER_RE =
  /(facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|pinterest|redditbot|applebot|bingbot|googlebot|embedly|quora|vkshare|w3c_validator|bot|crawler|spider|preview)/i;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanThumb(value, supabaseUrl, ownerId, flyerId) {
  if (value) return String(value).split("?")[0];
  if (supabaseUrl && ownerId && flyerId) {
    return `${supabaseUrl}/storage/v1/object/public/flyer-thumbnails/${ownerId}/${flyerId}.jpg`;
  }
  return null;
}

async function fetchFlyer(env, slug) {
  const url = `${env.SUPABASE_URL}/rest/v1/flyers?public_slug=eq.${encodeURIComponent(
    slug
  )}&status=eq.published&select=id,owner_id,title,public_slug,thumbnail_url&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
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

<meta http-equiv="refresh" content="0;url=${c}" />
</head>
<body>
<p>Redirecting to <a href="${c}">${t}</a>…</p>
<script>window.location.replace(${JSON.stringify(canonical)});</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";
    const isCrawler = CRAWLER_RE.test(ua);

    // Root → app homepage
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(env.APP_ORIGIN || "https://interactive-flyer-studio.lovable.app", 302);
    }

    // /f/:slug
    const match = url.pathname.match(/^\/f\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) {
      return new Response("Not found", { status: 404 });
    }
    const slug = match[1];
    const appOrigin = env.APP_ORIGIN || "https://interactive-flyer-studio.lovable.app";
    const viewerUrl = `${appOrigin}/f/${slug}`;

    // Humans → straight to the interactive viewer.
    if (!isCrawler) {
      return Response.redirect(viewerUrl, 302);
    }

    // Crawlers → look up flyer, serve OG HTML.
    let flyer = null;
    try {
      flyer = await fetchFlyer(env, slug);
    } catch (_) {
      flyer = null;
    }

    const title = flyer?.title || "Flyer";
    const description = `View "${title}" — interactive flyer.`;
    const image =
      cleanThumb(flyer?.thumbnail_url, env.SUPABASE_URL, flyer?.owner_id, flyer?.id) ||
      `${appOrigin}/og.png`;

    return new Response(ogHtml({ title, description, image, canonical: viewerUrl }), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-share-worker": "v1",
      },
    });
  },
};
