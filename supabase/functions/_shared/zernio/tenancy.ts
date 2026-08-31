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

/**
 * Reads the client's effective plan + current usage. Never trusts the browser.
 * Runs with the service role, so it queries the tables directly rather than the
 * auth.uid()-scoped RPC used by the front end.
 */
export async function planLimits(supabase: Supabase, userId: string): Promise<PlanSnapshot> {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);

  const { data: sub } = await supabase
    .from("client_subscriptions")
    .select("plan_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  let plan: PlanSnapshot["plan"] = null;
  if (sub?.plan_id) {
    const { data } = await supabase.from("plans").select("*").eq("id", sub.plan_id).maybeSingle();
    plan = (data ?? null) as PlanSnapshot["plan"];
  }
  if (!plan) {
    const { data } = await supabase
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("is_default", { ascending: false })
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    plan = (data ?? null) as PlanSnapshot["plan"];
  }

  const [posts, scheduled, accounts] = await Promise.all([
    supabase
      .from("zernio_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "draft")
      .gte("created_at", periodStart.toISOString()),
    supabase
      .from("zernio_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "scheduled"),
    supabase
      .from("zernio_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "connected"),
  ]);

  if (!plan) return EMPTY;
  return {
    plan,
    usage: {
      posts_this_month: posts.count ?? 0,
      scheduled_posts: scheduled.count ?? 0,
      connected_accounts: accounts.count ?? 0,
    },
  };
}

