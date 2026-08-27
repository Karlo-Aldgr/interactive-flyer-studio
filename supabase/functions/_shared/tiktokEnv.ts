/**
 * Single source of truth for which TikTok app (Sandbox vs Production) the
 * server-side OAuth + Content Posting code should use.
 *
 * TIKTOK_ENV = "sandbox" -> TIKTOK_SANDBOX_CLIENT_KEY / TIKTOK_SANDBOX_CLIENT_SECRET
 * anything else (default) -> TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
 *
 * Credentials are read from Deno.env only — never sent to the browser.
 */
export type TikTokEnvName = "sandbox" | "production";

export function tiktokEnvName(): TikTokEnvName {
  const raw = Deno.env.get("TIKTOK_ENV")?.trim().toLowerCase();
  return raw === "sandbox" || raw === "test" ? "sandbox" : "production";
}

export function tiktokSecretNames(): { keyName: string; secretName: string } {
  return tiktokEnvName() === "sandbox"
    ? { keyName: "TIKTOK_SANDBOX_CLIENT_KEY", secretName: "TIKTOK_SANDBOX_CLIENT_SECRET" }
    : { keyName: "TIKTOK_CLIENT_KEY", secretName: "TIKTOK_CLIENT_SECRET" };
}

export type TikTokCredentials = {
  env: TikTokEnvName;
  clientKey: string;
  clientSecret: string;
  keyName: string;
  secretName: string;
};

/** Returns the credentials for the active TikTok environment, or the missing names. */
export function tiktokCredentials(): TikTokCredentials | { missing: string[] } {
  const env = tiktokEnvName();
  const { keyName, secretName } = tiktokSecretNames();
  const clientKey = Deno.env.get(keyName)?.trim() || "";
  const clientSecret = Deno.env.get(secretName)?.trim() || "";
  const missing: string[] = [];
  if (!clientKey) missing.push(keyName);
  if (!clientSecret) missing.push(secretName);
  if (missing.length) return { missing };
  return { env, clientKey, clientSecret, keyName, secretName };
}

/** Safe-to-log masked form of a client key, e.g. "aw12…9x8z". */
export function maskKey(value: string) {
  if (!value) return "(unset)";
  if (value.length <= 8) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
