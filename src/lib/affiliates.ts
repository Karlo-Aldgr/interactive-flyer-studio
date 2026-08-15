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

export async function loadMyAffiliateApplication(
  userId: string,
  email?: string | null,
): Promise<AffiliateApplication | null> {
  const orFilter = email
    ? `applicant_user_id.eq.${userId},email.eq.${email}`
    : `applicant_user_id.eq.${userId}`;
  const { data } = await db
    .from("affiliate_applications")
    .select("*")
    .or(orFilter)
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
  if (error) {
    if (error.code === "23505" || /duplicate key|unique/i.test(error.message ?? "")) {
      throw new Error("An application for this email is already pending review.");
    }
    throw error;
  }
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

/* ============================================================
   Phase 2 — clicks, payouts, assets, coupons, notifications
   ============================================================ */

export type AffiliateClick = {
  id: string;
  affiliate_id: string;
  code: string;
  channel: string;
  referrer: string | null;
  landing_path: string | null;
  created_at: string;
};

export type AffiliatePayout = {
  id: string;
  affiliate_id: string;
  amount_cents: number;
  status: "requested" | "approved" | "paid" | "rejected";
  method: string;
  payout_email: string | null;
  admin_note: string | null;
  requested_at: string;
  paid_at: string | null;
};

export type AdminPayoutRow = AffiliatePayout & { affiliate_name: string; code: string };

export type AffiliateAsset = {
  id: string;
  title: string;
  description: string | null;
  asset_type: string;
  image_url: string | null;
  link_url: string | null;
  body_text: string | null;
  active: boolean;
  sort_order: number;
};

export type AffiliateCoupon = {
  id: string;
  affiliate_id: string | null;
  code: string;
  description: string | null;
  discount_percent: number;
  active: boolean;
  redemption_count: number;
};

export type AffiliateNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type AffiliateBalance = {
  approved_cents: number;
  pending_cents: number;
  paid_out_cents: number;
  requested_cents: number;
};

export type AdminReferralRow = {
  id: string;
  affiliate_id: string;
  affiliate_name: string;
  code: string;
  referred_email: string | null;
  referred_name: string | null;
  channel: string;
  status: string;
  fraud_flag: string | null;
  commission_cents: number | null;
  converted_at: string | null;
  created_at: string;
};

export type AdminCommissionRow = {
  id: string;
  affiliate_id: string;
  affiliate_name: string;
  code: string;
  amount_cents: number;
  status: string;
  description: string | null;
  created_at: string;
  paid_at: string | null;
};

export type AffiliateOverview = {
  participants: number;
  invites: number;
  clicks: number;
  signups: number;
  converts: number;
  earned_cents: number;
  paid_cents: number;
  pending_payout_cents: number;
  flagged: number;
  channels: { name: string; clicks: number; signups: number }[];
  rows: {
    id: string;
    code: string;
    name: string;
    status: string;
    commission_rate: number;
    clicks: number;
    signups: number;
    converts: number;
    earned_cents: number;
  }[];
};

export const DEFAULT_COMMISSION_RATE = 20;
export const DEFAULT_MIN_PAYOUT_CENTS = 5000;

export async function loadProgramSettings(): Promise<{ default_rate: number; min_payout_cents: number; cookie_days: number }> {
  const { data } = await db.from("app_settings").select("value").eq("key", "affiliate_program").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, number>;
  return {
    default_rate: v.default_rate ?? DEFAULT_COMMISSION_RATE,
    min_payout_cents: v.min_payout_cents ?? DEFAULT_MIN_PAYOUT_CENTS,
    cookie_days: v.cookie_days ?? 14,
  };
}

export async function saveProgramSettings(value: { default_rate: number; min_payout_cents: number; cookie_days: number }) {
  const { error } = await db.from("app_settings").upsert({ key: "affiliate_program", value });
  if (error) throw error;
}

export async function loadAffiliateBalance(affiliateId: string): Promise<AffiliateBalance> {
  const { data } = await db.rpc("affiliate_balance", { _affiliate_id: affiliateId });
  return (data as AffiliateBalance) ?? { approved_cents: 0, pending_cents: 0, paid_out_cents: 0, requested_cents: 0 };
}

export async function loadAffiliateClicks(affiliateId: string): Promise<AffiliateClick[]> {
  const { data } = await db
    .from("affiliate_clicks")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as AffiliateClick[]) ?? [];
}

export async function loadAffiliatePayouts(affiliateId: string): Promise<AffiliatePayout[]> {
  const { data } = await db
    .from("affiliate_payouts")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("requested_at", { ascending: false });
  return (data as AffiliatePayout[]) ?? [];
}

export async function requestPayout(amountCents: number, payoutEmail?: string) {
  const { data, error } = await db.rpc("affiliate_request_payout", {
    _amount_cents: amountCents,
    _payout_email: payoutEmail ?? null,
  });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.message ?? "Payout request failed");
  return data as { ok: boolean; message: string };
}

export async function loadAffiliateAssets(activeOnly = true): Promise<AffiliateAsset[]> {
  let q = db.from("affiliate_assets").select("*").order("sort_order").order("created_at", { ascending: false });
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data as AffiliateAsset[]) ?? [];
}

export async function saveAffiliateAsset(asset: Partial<AffiliateAsset> & { title: string }) {
  const { error } = asset.id
    ? await db.from("affiliate_assets").update(asset).eq("id", asset.id)
    : await db.from("affiliate_assets").insert(asset);
  if (error) throw error;
}

export async function deleteAffiliateAsset(id: string) {
  const { error } = await db.from("affiliate_assets").delete().eq("id", id);
  if (error) throw error;
}

export async function loadCoupons(affiliateId?: string): Promise<AffiliateCoupon[]> {
  let q = db.from("affiliate_coupons").select("*").order("created_at", { ascending: false });
  if (affiliateId) q = q.eq("affiliate_id", affiliateId);
  const { data } = await q;
  return (data as AffiliateCoupon[]) ?? [];
}

export async function adminUpsertCoupon(input: {
  code: string;
  affiliate_id?: string | null;
  description?: string | null;
  discount?: number;
  active?: boolean;
}) {
  const { data, error } = await db.rpc("admin_upsert_coupon", {
    _code: input.code,
    _affiliate_id: input.affiliate_id ?? null,
    _description: input.description ?? null,
    _discount: input.discount ?? 10,
    _active: input.active ?? true,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteCoupon(id: string) {
  const { error } = await db.rpc("admin_delete_coupon", { _id: id });
  if (error) throw error;
}

export async function loadMyNotifications(): Promise<AffiliateNotification[]> {
  const { data } = await db
    .from("affiliate_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data as AffiliateNotification[]) ?? [];
}

export async function adminAffiliateOverview(): Promise<AffiliateOverview> {
  const { data, error } = await db.rpc("admin_affiliate_overview");
  if (error) throw error;
  return data as AffiliateOverview;
}

export async function adminListPayouts(): Promise<AdminPayoutRow[]> {
  const { data, error } = await db.rpc("admin_list_payouts");
  if (error) throw error;
  return (data as AdminPayoutRow[]) ?? [];
}

export async function adminUpdatePayout(id: string, status: "approved" | "paid" | "rejected", note?: string) {
  const { data, error } = await db.rpc("admin_update_payout", { _payout_id: id, _status: status, _note: note ?? null });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.message);
  return data;
}

export async function adminListReferrals(): Promise<AdminReferralRow[]> {
  const { data, error } = await db.rpc("admin_list_referrals");
  if (error) throw error;
  return (data as AdminReferralRow[]) ?? [];
}

export async function adminListCommissions(): Promise<AdminCommissionRow[]> {
  const { data, error } = await db.rpc("admin_list_commissions");
  if (error) throw error;
  return (data as AdminCommissionRow[]) ?? [];
}

export async function adminSetAffiliateRate(affiliateId: string, rate: number) {
  const { data, error } = await db.rpc("admin_set_affiliate_rate", { _affiliate_id: affiliateId, _rate: rate });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.message);
}

export async function adminRecordConversion(referralId: string, saleCents: number, description?: string) {
  const { data, error } = await db.rpc("admin_record_conversion", {
    _referral_id: referralId,
    _sale_cents: saleCents,
    _description: description ?? null,
  });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.message);
  return data as { ok: boolean; commission_cents: number };
}

/** Download any row set as CSV. */
export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
