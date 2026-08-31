import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side helpers for the Zernio integration. Everything privileged goes
 * through the `zernio-accounts` edge function — the business API key is never
 * present in the browser.
 */

export type ZernioAccountRow = {
  id: string;
  platform: string;
  account_name: string | null;
  username: string | null;
  avatar_url: string | null;
  status: string;
  status_detail: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  zernio_account_id: string;
};

export type ZernioStatus = {
  configured: boolean;
  has_profile: boolean;
  profile: { profile_name: string | null; status: string } | null;
  platforms: string[];
  accounts: ZernioAccountRow[];
};

export const ZERNIO_PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X / Twitter",
  pinterest: "Pinterest",
  threads: "Threads",
  bluesky: "Bluesky",
  reddit: "Reddit",
  google_business: "Google Business",
  telegram: "Telegram",
  snapchat: "Snapchat",
  whatsapp: "WhatsApp",
  discord: "Discord",
  slack: "Slack",
};

export function zernioPlatformLabel(platform: string) {
  return ZERNIO_PLATFORM_LABEL[platform] ?? platform.replace(/_/g, " ");
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("zernio-accounts", { body });
  if (error) throw new Error(error.message || "Zernio request failed.");
  if (data?.error) throw new Error(data.error as string);
  return data as T;
}

export function fetchZernioStatus() {
  return call<ZernioStatus>({ action: "status" });
}

export function syncZernioAccounts() {
  return call<{ ok: true; accounts: ZernioAccountRow[] }>({ action: "sync" });
}

export function startZernioConnect(platform: string, redirectPath = "/dashboard/social") {
  return call<{ authorize_url: string }>({
    action: "connect",
    platform,
    redirect_path: redirectPath,
  });
}

export function disconnectZernioAccount(accountId: string) {
  return call<{ ok: true; accounts: ZernioAccountRow[] }>({
    action: "disconnect",
    account_id: accountId,
  });
}

// ------------------------------------------------------------- admin ----

export type AdminZernioRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  zernio_profile_id: string;
  profile_name: string | null;
  profile_status: string;
  accounts: {
    id: string;
    platform: string;
    account_name: string | null;
    username: string | null;
    avatar_url: string | null;
    status: string;
    last_synced_at: string | null;
  }[];
};

export async function fetchAdminZernioOverview(): Promise<AdminZernioRow[]> {
  const { data, error } = await supabase.rpc("admin_zernio_overview" as never);
  if (error) throw error;
  return (data ?? []) as unknown as AdminZernioRow[];
}
