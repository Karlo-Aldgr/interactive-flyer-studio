import { supabase } from "@/integrations/supabase/client";

export type MenuOrderInsert = {
  flyer_id: string;
  action_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  items: unknown[];
  subtotal_cents: number;
  notes?: string | null;
  table_number: string;
  order_type: string;
  pickup_at?: string | null;
  status: string;
  payment_method?: "pay_now" | "pay_later";
  payment_status?: string;
  paid_at?: string | null;
};

function isSchemaColumnError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("payment_method") ||
    m.includes("paid_at") ||
    m.includes("could not find") ||
    (m.includes("column") && m.includes("schema"))
  );
}

/** Insert menu order; retries without new payment columns if migration not applied yet. */
export async function insertMenuOrder(
  row: MenuOrderInsert,
): Promise<{ id: string | null; error: string | null; usedFallback: boolean }> {
  const base = {
    flyer_id: row.flyer_id,
    action_id: row.action_id || null,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone || null,
    items: row.items,
    subtotal_cents: row.subtotal_cents,
    notes: row.notes || null,
    table_number: row.table_number,
    order_type: row.order_type,
    pickup_at: row.pickup_at || null,
    status: row.status,
    payment_status: row.payment_status || "unpaid",
    payment_method: row.payment_method || "pay_later",
    paid_at: row.paid_at || null,
  };

  let { data, error } = await supabase
    .from("menu_orders")
    .insert([base as any])
    .select("id")
    .single();

  if (error && isSchemaColumnError(error.message)) {
    const { payment_method: _pm, paid_at: _pa, ...legacy } = base;
    ({ data, error } = await supabase
      .from("menu_orders")
      .insert([legacy as any])
      .select("id")
      .single());
    if (!error) {
      return { id: data?.id ?? null, error: null, usedFallback: true };
    }
  }

  if (error) return { id: null, error: error.message, usedFallback: false };
  return { id: data?.id ?? null, error: null, usedFallback: false };
}
