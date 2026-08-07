import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export type ApiKeyRecord = {
  id: string;
  owner_id: string;
  key_prefix: string;
  scopes: string[];
  label: string;
};

/** SHA-256 hex digest — the only representation of a key we ever store. */
export async function hashApiKey(rawKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(rawKey.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function keyPrefix(rawKey: string) {
  return rawKey.trim().slice(0, 16);
}

/** Look up a live API key by its presented value. Never logs the raw key. */
export async function authenticateApiKey(
  supabase: SupabaseClient,
  rawKey: string | null,
): Promise<{ key: ApiKeyRecord } | { error: string; status: number }> {
  const presented = (rawKey || "").trim();
  if (!presented) {
    return { error: "Missing X-API-Key header", status: 401 };
  }
  if (!/^ttf_(live|test)_[A-Za-z0-9]{16,}$/.test(presented)) {
    return { error: "Invalid API key format", status: 401 };
  }

  const hash = await hashApiKey(presented);
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, owner_id, key_prefix, scopes, label, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error) return { error: "Key lookup failed", status: 500 };
  if (!data) return { error: "Invalid API key", status: 401 };
  if (data.revoked_at) return { error: "This API key has been revoked", status: 401 };

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    key: {
      id: String(data.id),
      owner_id: String(data.owner_id),
      key_prefix: String(data.key_prefix),
      scopes: (data.scopes as string[]) ?? [],
      label: String(data.label),
    },
  };
}

export function hasScope(key: ApiKeyRecord, scope: string) {
  return key.scopes.includes(scope) || key.scopes.includes("*");
}
