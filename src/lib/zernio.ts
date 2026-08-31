import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side helpers for the Zernio integration. Everything privileged goes
 * through the `zernio-*` edge functions — the business API key is never
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

export type PlanSnapshot = {
  plan: {
    id: string;
    slug: string;
    name: string;
    price_cents: number;
    currency: string;
    billing_period: string;
    max_social_accounts: number;
    max_posts_per_month: number;
    max_scheduled_posts: number;
    max_team_members: number;
    analytics_access: boolean;
    ai_features: boolean;
    priority_support: boolean;
  } | null;
  usage: {
    posts_this_month: number;
    scheduled_posts: number;
    connected_accounts: number;
  };
};

export type ZernioStatus = {
  configured: boolean;
  has_profile: boolean;
  profile: { profile_name: string | null; status: string } | null;
  platforms: string[];
  accounts: ZernioAccountRow[];
  limits: PlanSnapshot;
};

export type ZernioPostRow = {
  id: string;
  title: string | null;
  content: string;
  media: { type: string; url: string }[];
  platforms: string[];
  account_ids: string[];
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  last_error: string | null;
  created_at: string;
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
  mastodon: "Mastodon",
  tumblr: "Tumblr",
};

export function zernioPlatformLabel(platform: string) {
  return ZERNIO_PLATFORM_LABEL[platform] ?? platform.replace(/_/g, " ");
}

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Edge functions return JSON error bodies alongside non-2xx statuses.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) throw new Error(parsed.error as string);
      } catch (inner) {
        if (inner instanceof Error && inner.message) throw inner;
      }
    }
    throw new Error(error.message || "Request failed.");
  }
  if (data?.error) throw new Error(data.error as string);
  return data as T;
}

// ------------------------------------------------------------ accounts ----

export function fetchZernioStatus() {
  return call<ZernioStatus>("zernio-accounts", { action: "status" });
}

export function syncZernioAccounts() {
  return call<{ ok: true; accounts: ZernioAccountRow[]; limits: PlanSnapshot }>(
    "zernio-accounts",
    { action: "sync" },
  );
}

export function startZernioConnect(platform: string, redirectPath = "/dashboard/social") {
  return call<{ authorize_url: string }>("zernio-accounts", {
    action: "connect",
    platform,
    redirect_path: redirectPath,
  });
}

export function disconnectZernioAccount(accountId: string) {
  return call<{ ok: true; accounts: ZernioAccountRow[]; limits: PlanSnapshot }>(
    "zernio-accounts",
    { action: "disconnect", account_id: accountId },
  );
}

// --------------------------------------------------------------- posts ----

export function fetchZernioPosts() {
  return call<{ posts: ZernioPostRow[]; limits: PlanSnapshot }>("zernio-posts", { action: "list" });
}

export function createZernioPost(input: {
  mode: "draft" | "publish" | "schedule";
  content: string;
  title?: string | null;
  media?: { type: string; url: string }[];
  account_ids: string[];
  scheduled_at?: string | null;
  timezone?: string;
}) {
  return call<{ ok: true; post: ZernioPostRow; warnings?: string[] }>("zernio-posts", {
    action: "create",
    ...input,
    timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

export function refreshZernioPost(postId: string) {
  return call<{ post: ZernioPostRow }>("zernio-posts", { action: "refresh", post_id: postId });
}

export function cancelZernioPost(postId: string) {
  return call<{ ok: true }>("zernio-posts", { action: "cancel", post_id: postId });
}

export function deleteZernioPost(postId: string) {
  return call<{ ok: true }>("zernio-posts", { action: "delete", post_id: postId });
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

export function adminSyncClientAccounts(userId: string) {
  return call<{ ok: true; synced: number }>("zernio-admin", {
    action: "admin_sync",
    user_id: userId,
  });
}

export function adminDisconnectAccount(accountId: string) {
  return call<{ ok: true }>("zernio-admin", {
    action: "admin_disconnect",
    account_id: accountId,
  });
}

export type AdminPublishingRow = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  status: string;
  platforms: string[];
  scheduled_at: string | null;
  published_at: string | null;
  last_error: string | null;
  created_at: string;
};

export function fetchAdminPublishingHistory(userId?: string) {
  return call<{ posts: AdminPublishingRow[] }>("zernio-admin", {
    action: "publishing_history",
    ...(userId ? { user_id: userId } : {}),
  });
}
