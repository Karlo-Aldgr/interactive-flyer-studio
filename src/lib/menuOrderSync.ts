import { supabase } from "@/integrations/supabase/client";
import {
  foodStatusToMirrorFormStatus,
  menuStatusToFoodStatus,
  type FoodOrderStatus,
} from "@/lib/menuOrderStatus";

export type MenuOrderRow = {
  id: string;
  flyer_id: string;
  customer_name: string;
  customer_phone?: string | null;
  items: unknown[];
  subtotal_cents: number;
  notes?: string | null;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  paid_at?: string | null;
  table_number?: string | null;
  order_type?: string;
  pickup_at?: string | null;
  created_at: string;
  updated_at?: string;
  archived_at?: string | null;
};

/** Keep `form_submissions` mirror in sync when `menu_orders` changes. */
export async function syncFormSubmissionMirror(order: MenuOrderRow): Promise<void> {
  const food = menuStatusToFoodStatus(order.status);
  const mirrorStatus = foodStatusToMirrorFormStatus(food);
  const { data: rows, error: selErr } = await supabase
    .from("form_submissions")
    .select("id, data")
    .eq("flyer_id", order.flyer_id)
    .filter("data->>menu_order_id", "eq", order.id);
  if (selErr || !rows?.length) return;

  for (const row of rows) {
    const nextData = {
      ...(row.data as Record<string, unknown>),
      payment_status: order.payment_status,
      payment_method: order.payment_method || "pay_later",
      paid_at: order.paid_at || null,
      food_status: food,
    };
    await supabase
      .from("form_submissions")
      .update({ status: mirrorStatus, data: nextData as any })
      .eq("id", row.id);
  }
}

export async function updateMenuOrderFoodStatus(
  orderId: string,
  foodStatus: FoodOrderStatus,
): Promise<{ error: string | null }> {
  const menuStatus =
    foodStatus === "pending" ? "new"
    : foodStatus === "in_production" ? "preparing"
    : foodStatus;
  const { data: row, error } = await supabase
    .from("menu_orders")
    .update({ status: menuStatus })
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (row) await syncFormSubmissionMirror(row as MenuOrderRow);
  return { error: null };
}

export async function markMenuOrderPaid(
  orderId: string,
  paidBy?: string,
): Promise<{ error: string | null }> {
  const paidAt = new Date().toISOString();
  let patch: { payment_status: string; paid_at?: string } = { payment_status: "paid", paid_at: paidAt };
  let { data: row, error } = await supabase
    .from("menu_orders")
    .update(patch)
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  if (error?.message?.toLowerCase().includes("paid_at")) {
    patch = { payment_status: "paid" };
    ({ data: row, error } = await supabase
      .from("menu_orders")
      .update(patch)
      .eq("id", orderId)
      .select("*")
      .maybeSingle());
  }
  if (error) return { error: error.message };
  if (row) {
    await syncFormSubmissionMirror({ ...(row as MenuOrderRow), payment_status: "paid", paid_at: paidAt });
    const { data: subs } = await supabase
      .from("form_submissions")
      .select("id, data")
      .filter("data->>menu_order_id", "eq", orderId);
    for (const sub of subs || []) {
      await supabase
        .from("form_submissions")
        .update({
          data: { ...(sub.data as object), paid_by: paidBy || "staff", paid_at: paidAt, payment_status: "paid" },
        } as any)
        .eq("id", sub.id);
    }
  }
  return { error: null };
}

export async function upsertDailySummary(flyerId: string, date: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("upsert_menu_daily_summary", {
    p_flyer_id: flyerId,
    p_date: date,
  });
  if (error?.message?.includes("Could not find the function")) {
    return { error: null };
  }
  return { error: error?.message || null };
}
