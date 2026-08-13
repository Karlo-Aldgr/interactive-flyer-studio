import { supabase } from "@/integrations/supabase/client";

export type AffiliateApplication = {
  id: string;
  applicant_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  audience: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Affiliate = {
  id: string;
  user_id: string;
  code: string;
  full_name: string | null;
  email: string | null;
  payout_email: string | null;
  commission_rate: number;
  status: string;
  created_at: string;
};

export type AffiliateReferral = {
  id: string;
  affiliate_id: string;
  referred_email: string | null;
  referred_name: string | null;
  source: string | null;
  status: string;
  converted_at: string | null;
  created_at: string;
};

export type AffiliateCommission = {
  id: string;
  affiliate_id: string;
  referral_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  paid_at: string | null;
  created_at: string;
};

export type AdminAffiliateRow = Affiliate & {
  referral_count: number;
  pending_cents: number;
  paid_cents: number;
};

const db = supabase as any;

export function affiliateLink(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://tapthatflyer.com";
  return `${origin}/?ref=${code}`;
}

export function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export async function loadMyAffiliate(userId: string): Promise<Affiliate | null> {
  const { data } = await db.from("affiliates").select("*").eq("user_id", userId).maybeSingle();
  return (data as Affiliate) ?? null;
}

export async function loadMyAffiliateApplication(userId: string): Promise<AffiliateApplication | null> {
  const { data } = await db
    .from("affiliate_applications")
    .select("*")
    .eq("applicant_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AffiliateApplication) ?? null;
}

export async function submitAffiliateApplication(payload: {
  applicant_user_id: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  audience?: string | null;
  message?: string | null;
}) {
  const { error } = await db.from("affiliate_applications").insert(payload);
  if (error) throw error;
}

export async function loadAffiliateReferrals(affiliateId: string): Promise<AffiliateReferral[]> {
  const { data } = await db
    .from("affiliate_referrals")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false });
  return (data as AffiliateReferral[]) ?? [];
}

export async function loadAffiliateCommissions(affiliateId: string): Promise<AffiliateCommission[]> {
  const { data } = await db
    .from("affiliate_commissions")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false });
  return (data as AffiliateCommission[]) ?? [];
}

export async function updatePayoutEmail(affiliateId: string, payoutEmail: string) {
  const { error } = await db.from("affiliates").update({ payout_email: payoutEmail }).eq("id", affiliateId);
  if (error) throw error;
}

export async function adminListAffiliateApplications(): Promise<AffiliateApplication[]> {
  const { data, error } = await db.rpc("admin_list_affiliate_applications");
  if (error) throw error;
  return (data as AffiliateApplication[]) ?? [];
}

export async function adminReviewAffiliateApplication(
  applicationId: string,
  decision: "approved" | "rejected",
  notes?: string,
) {
  const { data, error } = await db.rpc("admin_review_affiliate_application", {
    _application_id: applicationId,
    _decision: decision,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function adminListAffiliates(): Promise<AdminAffiliateRow[]> {
  const { data, error } = await db.rpc("admin_list_affiliates");
  if (error) throw error;
  return (data as AdminAffiliateRow[]) ?? [];
}

export async function adminSetAffiliateStatus(affiliateId: string, status: "active" | "paused") {
  const { error } = await db.from("affiliates").update({ status }).eq("id", affiliateId);
  if (error) throw error;
}
