// Server-only authenticated encryption for social tokens (AES-256-GCM).
//
// Required environment secret: SOCIAL_TOKEN_ENCRYPTION_KEY
//   32 random bytes, base64 encoded, e.g. `openssl rand -base64 32`.
// Ciphertext format: v1.<base64 iv>.<base64 ciphertext+tag>
//
// Nothing in this module may ever run in the browser.

const KEY_ENV = "SOCIAL_TOKEN_ENCRYPTION_KEY";
let cachedKey: CryptoKey | null = null;

export class EncryptionNotConfigured extends Error {
  constructor() {
    super(`${KEY_ENV} is not set. Add it in Project Settings → Secrets (32 random bytes, base64).`);
  }
}

function decodeBase64(value: string): Uint8Array {
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function encryptionConfigured(): boolean {
  const raw = Deno.env.get(KEY_ENV)?.trim();
  if (!raw) return false;
  try {
    return decodeBase64(raw).length === 32;
  } catch {
    return false;
  }
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = Deno.env.get(KEY_ENV)?.trim();
  if (!raw) throw new EncryptionNotConfigured();
  const bytes = decodeBase64(raw);
  if (bytes.length !== 32) throw new EncryptionNotConfigured();
  cachedKey = await crypto.subtle.importKey("raw", bytes as unknown as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      new TextEncoder().encode(plain) as unknown as BufferSource,
    ),
  );
  return `v1.${encodeBase64(iv)}.${encodeBase64(cipher)}`;
}

export async function decryptSecret(payload: string | null | undefined): Promise<string | null> {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const key = await getKey();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64(parts[1]) as unknown as BufferSource },
      key,
      decodeBase64(parts[2]) as unknown as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Random URL-safe token used for OAuth `state` values. */
export function randomToken(bytes = 32): string {
  return encodeBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Only the SHA-256 hash of a state value is persisted. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** PKCE S256 challenge for platforms that require it (X, TikTok). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return encodeBase64(new Uint8Array(digest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
