/**
 * tiktok-media — streams an ORIGINAL flyer video/image from private storage
 * under a TapThatFlyer-owned URL so TikTok's PULL_FROM_URL can verify the
 * URL prefix (`https://tapthatflyer.com/media/tiktok/`).
 *
 * - Access is granted only by a short-lived HMAC token minted server-side at
 *   publish time for media the authorized owner selected.
 * - Storage is read with the service role on the server; no credentials, no
 *   redirect, and no permanent public URL are exposed.
 * - Range requests are passed through so TikTok can fetch partially.
 */
import { verifyTikTokMediaToken } from "../_shared/tiktokMedia.ts";

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function contentTypeFor(path: string, upstream: string | null): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (MIME[ext]) return MIME[ext];
  if (upstream && upstream !== "application/octet-stream") return upstream;
  return "video/mp4";
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = decodeURIComponent(
    url.pathname.replace(/^\/functions\/v1/, "").replace(/^\/tiktok-media\/?/, "").replace(
      /^\/+/,
      "",
    ),
  );
  if (!token) return new Response("Not found", { status: 404 });

  const ref = await verifyTikTokMediaToken(token);
  if ("error" in ref) return new Response(ref.error, { status: 403 });

  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const objectUrl = `${base}/storage/v1/object/authenticated/${ref.bucket}/${
    ref.path.split("/").map(encodeURIComponent).join("/")
  }`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  };
  const range = req.headers.get("range");
  if (range) headers.Range = range;

  const upstream = await fetch(objectUrl, {
    method: req.method === "HEAD" ? "HEAD" : "GET",
    headers,
    redirect: "follow",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Media unavailable (${upstream.status})`, { status: upstream.status });
  }

  const out = new Headers();
  out.set("Content-Type", contentTypeFor(ref.path, upstream.headers.get("content-type")));
  out.set("Accept-Ranges", "bytes");
  out.set("Cache-Control", "private, max-age=0, no-store");
  for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }

  return new Response(req.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
});
