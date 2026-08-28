/**
 * TikTok media URL ownership fix.
 *
 * TikTok's PULL_FROM_URL requires the media URL to live under a URL prefix the
 * app owner verified in the TikTok Developer Portal. Storage URLs live on a
 * hostname TapThatFlyer does not own, so every pull fails with
 * `url_ownership_unverified`.
 *
 * This module mints a short-lived, HMAC-signed token that points at the
 * ORIGINAL storage object and rewrites the URL to:
 *
 *   https://tapthatflyer.com/media/tiktok/<token>
 *
 * which is proxied (no redirect) to the `tiktok-media` edge function. The
 * original file is streamed untouched — no re-encoding, resizing or copying.
 */

const DEFAULT_ORIGIN = "https://tapthatflyer.com";
const PATH_PREFIX = "/media/tiktok/";
/** Short-lived: TikTok pulls the file within minutes of the init call. */
const TTL_SECONDS = 60 * 60 * 2;

function mediaOrigin(): string {
  const raw = Deno.env.get("TIKTOK_MEDIA_ORIGIN")?.trim();
  return (raw && /^https:\/\//.test(raw) ? raw : DEFAULT_ORIGIN).replace(/\/$/, "");
}

/** Signing key never leaves the server; only the derived signature is public. */
function signingKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

export type StorageRef = { bucket: string; path: string };

/** Parses a public/signed storage object URL for this project's storage host. */
export function parseStorageUrl(rawUrl: string): StorageRef | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  let baseHost = "";
  try {
    baseHost = new URL(base).hostname;
  } catch { /* ignore */ }
  if (baseHost && url.hostname !== baseHost) return null;
  const m = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
}

/**
 * Rewrites a storage media URL to the TapThatFlyer-owned proxy URL that TikTok
 * can verify. Non-storage URLs (manual uploads on other hosts) pass through.
 */
export async function toTikTokMediaUrl(rawUrl: string): Promise<string> {
  const ref = parseStorageUrl(rawUrl);
  if (!ref || !signingKey()) return rawUrl;
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({ b: ref.bucket, p: ref.path, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }),
    ),
  );
  const sig = await hmac(payload);
  return `${mediaOrigin()}${PATH_PREFIX}${payload}.${sig}`;
}

/** Verifies a proxy token and returns the storage object it points at. */
export async function verifyTikTokMediaToken(
  token: string,
): Promise<StorageRef | { error: string }> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { error: "Malformed media token" };
  if (!signingKey()) return { error: "Media proxy is not configured" };
  const expected = await hmac(payload);
  if (expected.length !== sig.length) return { error: "Invalid media token" };
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return { error: "Invalid media token" };
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      b?: string;
      p?: string;
      exp?: number;
    };
    if (!data.b || !data.p) return { error: "Invalid media token" };
    if (!data.exp || data.exp * 1000 < Date.now()) return { error: "Media link expired" };
    return { bucket: data.b, path: data.p };
  } catch {
    return { error: "Invalid media token" };
  }
}
