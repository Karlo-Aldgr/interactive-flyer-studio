// Server-only resolver for the Zernio API key.
//
// Order of precedence:
//   1. ZERNIO_API_KEY environment secret (unchanged, still supported)
//   2. public.integration_secrets row (service-role only; written by admins
//      through the zernio-admin edge function)
//
// The value never leaves the Edge Function boundary.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export const ZERNIO_SECRET_KEY = "zernio_api_key";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

let cached: { value: string | null; at: number } | null = null;
const TTL_MS = 30_000;

export function envZernioKey(): string | null {
  return Deno.env.get("ZERNIO_API_KEY")?.trim() || null;
}

/** Reads the stored key. Returns null when nothing is configured. */
export async function getZernioApiKey(): Promise<string | null> {
  const fromEnv = envZernioKey();
  if (fromEnv) return fromEnv;

  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  try {
    const { data } = await admin()
      .from("integration_secrets")
      .select("value")
      .eq("key", ZERNIO_SECRET_KEY)
      .maybeSingle();
    const value = (data?.value as string | undefined)?.trim() || null;
    cached = { value, at: Date.now() };
    return value;
  } catch (_err) {
    // Never log the error verbatim: it can echo request details.
    console.error(JSON.stringify({ scope: "zernio", operation: "read_secret", success: false }));
    return null;
  }
}

export function invalidateZernioKeyCache() {
  cached = null;
}

export async function saveZernioApiKey(value: string, updatedBy: string | null) {
  const { error } = await admin().from("integration_secrets").upsert(
    {
      key: ZERNIO_SECRET_KEY,
      value: value.trim(),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
      last_tested_at: null,
      last_test_ok: null,
      last_test_message: null,
    },
    { onConflict: "key" },
  );
  invalidateZernioKeyCache();
  return error ? error.message : null;
}

export async function removeZernioApiKey() {
  const { error } = await admin()
    .from("integration_secrets")
    .delete()
    .eq("key", ZERNIO_SECRET_KEY);
  invalidateZernioKeyCache();
  return error ? error.message : null;
}

export async function recordZernioTest(ok: boolean, message: string) {
  await admin()
    .from("integration_secrets")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_ok: ok,
      last_test_message: message.slice(0, 300),
    })
    .eq("key", ZERNIO_SECRET_KEY);
}

/** Non-secret metadata about the stored key, safe for admin UIs. */
export async function zernioSecretMeta() {
  const { data } = await admin()
    .from("integration_secrets")
    .select("updated_at, last_tested_at, last_test_ok, last_test_message")
    .eq("key", ZERNIO_SECRET_KEY)
    .maybeSingle();
  return data ?? null;
}
