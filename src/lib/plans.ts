import { supabase } from "@/integrations/supabase/client";

/** Plans, subscriptions and usage. Reads are RLS-scoped; writes are admin-only. */

export type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
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
  promo_text: string | null;
  display_order: number;
  is_default: boolean;
  active: boolean;
};

export type PlanDraft = Omit<Plan, "id"> & { id?: string };

export type ClientLimits = {
  plan: Plan | null;
  usage: { posts_this_month: number; scheduled_posts: number; connected_accounts: number };
  subscription: { status: string; current_period_end: string | null } | null;
};

export function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** 0 means unlimited across the whole limit system. */
export function limitLabel(value: number) {
  return value > 0 ? String(value) : "Unlimited";
}

export async function fetchPlans(includeInactive = false): Promise<Plan[]> {
  let query = supabase.from("plans").select("*").order("display_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function savePlan(plan: PlanDraft): Promise<Plan> {
  const { id, ...rest } = plan;
  const query = id
    ? supabase.from("plans").update(rest).eq("id", id).select("*").single()
    : supabase.from("plans").insert(rest).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return data as Plan;
}

export async function setPlanActive(id: string, active: boolean) {
  const { error } = await supabase.from("plans").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function fetchMyLimits(): Promise<ClientLimits> {
  const { data, error } = await supabase.rpc("client_plan_limits" as never);
  if (error) throw error;
  return (data ?? { plan: null, usage: { posts_this_month: 0, scheduled_posts: 0, connected_accounts: 0 }, subscription: null }) as unknown as ClientLimits;
}

export type ClientSubscriptionRow = {
  user_id: string;
  plan_id: string | null;
  status: string;
  current_period_end: string | null;
};

export async function fetchAllSubscriptions(): Promise<ClientSubscriptionRow[]> {
  const { data, error } = await supabase
    .from("client_subscriptions")
    .select("user_id, plan_id, status, current_period_end");
  if (error) throw error;
  return (data ?? []) as ClientSubscriptionRow[];
}

export async function assignPlan(userId: string, planId: string) {
  const { error } = await supabase
    .from("client_subscriptions")
    .upsert({ user_id: userId, plan_id: planId, status: "active" }, { onConflict: "user_id" });
  if (error) throw error;
}
