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

function isMissingRpcError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("place_menu_order") && (m.includes("could not find") || m.includes("does not exist"));
}

/** Insert menu order via RPC (avoids public SELECT RLS on insert().select()). */
export async function insertMenuOrder(
  row: MenuOrderInsert,
): Promise<{ id: string | null; error: string | null; usedFallback: boolean }> {
  const rpcArgs = {
    _flyer_id: row.flyer_id,
    _action_id: row.action_id || null,
    _customer_name: row.customer_name,
    _customer_phone: row.customer_phone || null,
    _items: row.items,
    _subtotal_cents: row.subtotal_cents,
    _notes: row.notes || null,
    _table_number: row.table_number,
    _order_type: row.order_type,
    _pickup_at: row.pickup_at || null,
    _status: row.status,
    _payment_method: row.payment_method || "pay_later",
    _payment_status: row.payment_status || "unpaid",
    _paid_at: row.paid_at || null,
  };

  let { data: orderId, error } = await supabase.rpc("place_menu_order" as any, rpcArgs);

  if (error && isMissingRpcError(error.message)) {
    return legacyDirectInsert(row);
  }

  if (error && isSchemaColumnError(error.message)) {
    const { _payment_method: _pm, _paid_at: _pa, ...legacyRpc } = rpcArgs;
    ({ data: orderId, error } = await supabase.rpc("place_menu_order" as any, legacyRpc));
    if (!error) {
      return { id: (orderId as string) ?? null, error: null, usedFallback: true };
    }
  }

  if (error) return { id: null, error: error.message, usedFallback: false };
  return { id: (orderId as string) ?? null, error: null, usedFallback: false };
}

/** Fallback when place_menu_order RPC is not deployed yet. */
async function legacyDirectInsert(
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

  const { error } = await supabase.from("menu_orders").insert([base as any]);
  if (error && isSchemaColumnError(error.message)) {
    const { payment_method: _pm, paid_at: _pa, ...legacy } = base;
    const retry = await supabase.from("menu_orders").insert([legacy as any]);
    if (!retry.error) {
      return { id: null, error: null, usedFallback: true };
    }
    return { id: null, error: retry.error.message, usedFallback: false };
  }

  if (error) return { id: null, error: error.message, usedFallback: false };
  return { id: null, error: null, usedFallback: true };
}
