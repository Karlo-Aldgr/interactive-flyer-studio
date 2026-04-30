// Edge function that returns Open Graph / Twitter meta tags for a published flyer,
// then redirects humans to the real interactive viewer.
// Used as the share URL so social platforms (Facebook, X, iMessage, WhatsApp, LinkedIn)
// preview the flyer's own thumbnail instead of a generic site image.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fallbackHtml(siteOrigin: string, message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Flyer not found</title></head><body><p>${escapeHtml(
    message
  )}</p><p><a href="${escapeHtml(siteOrigin)}">Return home</a></p></body></html>`;
}

function cleanThumbnailUrl(value: string | null | undefined): string | null {
  return value ? String(value).split("?")[0] : null;
}

function htmlResponse(html: string, status = 200, cacheControl = "public, max-age=300") {
  return new Response(new TextEncoder().encode(html), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl,
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  // Optional: caller can pass the site origin so we redirect to the right host.
  // Defaults to the request's referer host or a sensible fallback.
  const siteOrigin =
    url.searchParams.get("site") ||
    (req.headers.get("referer")
      ? new URL(req.headers.get("referer")!).origin
      : "");

  if (!slug) {
    return htmlResponse(fallbackHtml(siteOrigin, "Missing slug."), 400, "no-store");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: flyer, error } = await supabase
    .from("flyers")
    .select("id, owner_id, title, status, public_slug, thumbnail_url")
    .eq("public_slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !flyer) {
    return htmlResponse(fallbackHtml(siteOrigin, "This flyer is not available."), 404, "no-store");
  }

  const rawImageUrl =
    cleanThumbnailUrl(flyer.thumbnail_url) ||
    `${SUPABASE_URL}/storage/v1/object/public/flyer-thumbnails/${flyer.owner_id}/${flyer.id}.jpg`;

  if (url.searchParams.get("image") === "1") {
    const imageResponse = await fetch(rawImageUrl, {
      headers: { Accept: "image/*", "User-Agent": req.headers.get("user-agent") || "facebookexternalhit/1.1" },
    });

    if (!imageResponse.ok || !imageResponse.body) {
      return new Response("Preview image not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", ...corsHeaders },
      });
    }

    return new Response(imageResponse.body, {
      status: 200,
      headers: {
        "content-type": imageResponse.headers.get("content-type") || "image/jpeg",
        "cache-control": "public, max-age=86400",
        ...corsHeaders,
      },
    });
  }

  const targetUrl = `${siteOrigin || ""}/f/${flyer.public_slug}`;
  const title = escapeHtml(flyer.title || "Flyer");
  const description = escapeHtml(`View "${flyer.title || "this flyer"}" — interactive flyer.`);

  // Prefer the DB thumbnail_url. If missing, try the deterministic storage path
  // (the file may exist from an earlier capture even if the column wasn't updated).
  // Strip any cache-busting querystring — some social crawlers reject those on og:image.
  const imageUrl = new URL(`${SUPABASE_URL}/functions/v1/og-meta`);
  imageUrl.searchParams.set("slug", flyer.public_slug);
  if (siteOrigin) imageUrl.searchParams.set("site", siteOrigin);
  imageUrl.searchParams.set("image", "1");
  const image = escapeHtml(imageUrl.toString());
  const canonical = escapeHtml(targetUrl);

  // The user-agent check lets us:
  //   - Serve meta-tag HTML to social crawlers (they don't follow JS redirects).
  //   - Immediately redirect humans to the real viewer.
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const isCrawler = /(facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|pinterest|redditbot|applebot|bingbot|googlebot|embedly|quora|vkshare|w3c_validator|bot|crawler|spider)/i.test(
    ua
  );

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonical}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />

  ${isCrawler ? "" : `<meta http-equiv="refresh" content="0;url=${canonical}" />`}
  ${isCrawler ? "" : `<script>window.location.replace(${JSON.stringify(targetUrl)});</script>`}
</head>
<body>
  <p>Redirecting to <a href="${canonical}">${title}</a>…</p>
</body>
</html>`;

  return htmlResponse(html);
});
