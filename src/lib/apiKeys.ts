import { supabase } from "@/integrations/supabase/client";
import { sha256Hex } from "@/lib/sha256";

export type ApiKeyRow = {
  id: string;
  label: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type ApiRequestLogRow = {
  id: string;
  request_id: string;
  key_prefix: string | null;
  endpoint: string;
  platforms: string[];
  media_type: string | null;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
};

const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate a `ttf_live_...` key using the browser CSPRNG. */
function generateRawKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join("");
  return `ttf_live_${body}`;
}

export async function listApiKeys(ownerId: string) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, label, key_prefix, scopes, created_at, last_used_at, revoked_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiKeyRow[];
}

/** Creates a key and returns the plaintext value exactly once — it is never stored. */
export async function createApiKey(ownerId: string, label: string) {
  const rawKey = generateRawKey();
  const { data, error } = await supabase
    .from("api_keys")
    .insert([{
      owner_id: ownerId,
      label: label.trim() || "API key",
      key_prefix: rawKey.slice(0, 16),
      key_hash: sha256Hex(rawKey),
      scopes: ["publish"],
    }])
    .select("id, label, key_prefix, scopes, created_at, last_used_at, revoked_at")
    .single();
  if (error) throw new Error(error.message);
  return { key: data as ApiKeyRow, rawKey };
}

export async function revokeApiKey(id: string) {
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteApiKey(id: string) {
  const { error } = await supabase.from("api_keys").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listApiRequestLogs(ownerId: string, limit = 25) {
  const { data, error } = await supabase
    .from("api_request_logs")
    .select("id, request_id, key_prefix, endpoint, platforms, media_type, status, duration_ms, error_message, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiRequestLogRow[];
}

export function externalApiEndpoint() {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/external-post`;
}
