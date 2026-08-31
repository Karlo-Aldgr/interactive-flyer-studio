// Shared multi-tenant helpers: audit logging and server-side plan enforcement.
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

type Supabase = ReturnType<typeof createClient>;

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

/** Structured, secret-free audit trail (console + zernio_events). */
export async function logZernioEvent(
  supabase: Supabase,
  entry: {
    user_id: string | null;
    operation: string;
    zernio_profile_id?: string | null;
    zernio_account_id?: string | null;
    platform?: string | null;
    success: boolean;
    http_status?: number | null;
    error_category?: string | null;
    detail?: string | null;
  },
) {
  console.log(JSON.stringify({
    scope: "zernio",
    operation: entry.operation,
    user_id: entry.user_id,
    profile: entry.zernio_profile_id ?? null,
    account: entry.zernio_account_id ?? null,
    platform: entry.platform ?? null,
    success: entry.success,
    status: entry.http_status ?? null,
    error_category: entry.error_category ?? null,
    at: new Date().toISOString(),
  }));
  await supabase.from("zernio_events").insert({
    user_id: entry.user_id,
    operation: entry.operation,
    zernio_profile_id: entry.zernio_profile_id ?? null,
    zernio_account_id: entry.zernio_account_id ?? null,
    platform: entry.platform ?? null,
    success: entry.success,
    http_status: entry.http_status ?? null,
    error_category: entry.error_category ?? null,
    detail: entry.detail?.slice(0, 500) ?? null,
  });
}

const EMPTY: PlanSnapshot = {
  plan: null,
  usage: { posts_this_month: 0, scheduled_posts: 0, connected_accounts: 0 },
};

/** Reads the client's effective plan + current usage. Never trusts the browser. */
export async function planLimits(supabase: Supabase, userId: string): Promise<PlanSnapshot> {
  const { data, error } = await supabase.rpc("client_plan_limits", { _user_id: userId });
  if (error || !data) return EMPTY;
  return data as unknown as PlanSnapshot;
}
