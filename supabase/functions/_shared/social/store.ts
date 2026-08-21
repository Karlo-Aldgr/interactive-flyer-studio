// Server-only persistence helpers for social accounts, jobs and analytics.
// Tokens are decrypted here and never leave the Edge Function boundary.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { decryptSecret, encryptSecret, encryptionConfigured } from "./crypto.ts";
import { getAdapter } from "./registry.ts";
import {
  adapterError,
  type AdapterAccount,
  type AdapterError,
  type ResolvedAccount,
  type SocialPlatform,
} from "./types.ts";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Resolves the caller from the Authorization header. */
export async function requireUser(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

export function tokenEncryptionReady() {
  return encryptionConfigured();
}

/** Upsert accounts returned by an OAuth callback or a sync. */
export async function saveAccounts(
  supabase: SupabaseClient,
  userId: string,
  platform: SocialPlatform,
  accounts: ResolvedAccount[],
) {
  const now = new Date().toISOString();
  for (const account of accounts) {
    const row = {
      user_id: userId,
      platform,
      platform_account_id: account.platform_account_id,
      account_name: account.account_name,
      username: account.username,
      profile_image_url: account.profile_image_url,
      access_token_encrypted: await encryptSecret(account.access_token),
      refresh_token_encrypted: account.refresh_token
        ? await encryptSecret(account.refresh_token)
        : null,
      token_expires_at: account.token_expires_at ?? null,
      scopes: account.scopes,
      connection_status: "connected",
      status_detail: null,
      connected_at: now,
      last_synced_at: now,
      metadata: account.metadata ?? {},
    };
    const { error } = await supabase
      .from("social_accounts")
      .upsert(row, { onConflict: "user_id,platform,platform_account_id" });
    if (error) throw new Error(error.message);
  }
}

export type LoadedAccount = AdapterAccount;

/** Loads and decrypts one account. Never return this object to a browser. */
export async function loadAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<LoadedAccount | AdapterError> {
  const { data, error } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  if (error) return adapterError("unknown", error.message);
  if (!data) return adapterError("not_connected", "That social account no longer exists.");
  if (!tokenEncryptionReady()) {
    return adapterError(
      "not_configured",
      "SOCIAL_TOKEN_ENCRYPTION_KEY is not set, so stored tokens cannot be read.",
    );
  }
  const access = await decryptSecret(data.access_token_encrypted);
  if (!access) {
    return adapterError("auth_expired", "Stored credentials could not be read. Reconnect this account.");
  }
  return {
    id: data.id,
    user_id: data.user_id,
    platform: data.platform,
    platform_account_id: data.platform_account_id,
    account_name: data.account_name,
    username: data.username,
    access_token: access,
    refresh_token: await decryptSecret(data.refresh_token_encrypted),
    token_expires_at: data.token_expires_at,
    scopes: data.scopes ?? [],
    metadata: data.metadata ?? {},
  };
}

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Refreshes the stored token when it is expired or close to expiring. */
export async function ensureFreshToken(
  supabase: SupabaseClient,
  account: LoadedAccount,
): Promise<LoadedAccount | AdapterError> {
  if (!account.token_expires_at) return account;
  const expiry = new Date(account.token_expires_at).getTime();
  if (Number.isFinite(expiry) && expiry - Date.now() > REFRESH_MARGIN_MS) return account;

  const adapter = getAdapter(account.platform);
  const refreshed = await adapter.refreshToken(account);
  if (refreshed.ok === false) {
    await markAccountStatus(
      supabase,
      account.id,
      refreshed.code === "permission_missing" ? "permission_missing" : "reconnect_required",
      refreshed.message,
    );
    return refreshed;
  }
  const patch: Record<string, unknown> = {
    access_token_encrypted: await encryptSecret(refreshed.access_token),
    token_expires_at: refreshed.token_expires_at ?? null,
    connection_status: "connected",
    status_detail: null,
    last_synced_at: new Date().toISOString(),
  };
  if (refreshed.refresh_token) {
    patch.refresh_token_encrypted = await encryptSecret(refreshed.refresh_token);
  }
  await supabase.from("social_accounts").update(patch).eq("id", account.id);
  return {
    ...account,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? account.refresh_token,
    token_expires_at: refreshed.token_expires_at ?? null,
  };
}

export async function markAccountStatus(
  supabase: SupabaseClient,
  accountId: string,
  status: "connected" | "reconnect_required" | "permission_missing" | "revoked" | "error",
  detail: string | null,
) {
  await supabase
    .from("social_accounts")
    .update({ connection_status: status, status_detail: detail?.slice(0, 500) ?? null })
    .eq("id", accountId);
}

/** Maps an adapter error onto the account connection status. */
export function statusForError(code: string) {
  if (code === "auth_expired") return "reconnect_required" as const;
  if (code === "permission_missing" || code === "approval_required") {
    return "permission_missing" as const;
  }
  if (code === "not_connected") return "revoked" as const;
  return null;
}
