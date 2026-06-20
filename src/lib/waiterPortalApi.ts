import { supabase } from "@/integrations/supabase/client";

export type WaiterPortalWaiter = { id: string; name: string; color: string };
export type WaiterPortalOrder = {
  id: string;
  customer_name: string;
  items: unknown[];
  status: string;
  payment_status?: string;
  payment_method?: string | null;
  table_number: string | null;
  notes: string | null;
  order_type: string;
  pickup_at: string | null;
  created_at: string;
  subtotal_cents?: number;
};

type ListResult = {
  waiter: WaiterPortalWaiter;
  tables: string[];
  orders: WaiterPortalOrder[];
};

function parseRpcError(err: { message?: string } | null, data: unknown): string | null {
  if (!err && data && typeof data === "object" && "error" in data) {
    return String((data as { error: string }).error);
  }
  if (err?.message?.includes("Could not find the function")) return "RPC_MISSING";
  return err?.message || null;
}

/** Postgres RPC — works without edge functions on CarloSample dev. */
async function rpcWaiterPortal(
  flyerId: string,
  pin: string,
  action: "list" | "update_status" | "mark_paid",
  extra?: { orderId?: string; status?: string },
): Promise<ListResult | { ok: true } | null> {
  const { data, error } = await supabase.rpc("waiter_portal_rpc", {
    p_flyer_id: flyerId,
    p_pin: pin,
    p_action: action,
    p_order_id: extra?.orderId ?? null,
    p_status: extra?.status ?? null,
  });
  const rpcErr = parseRpcError(error, data);
  if (rpcErr === "RPC_MISSING") return null;
  if (rpcErr) throw new Error(rpcErr);
  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as ListResult | { ok: true };
}

async function edgeList(flyerId: string, pin: string): Promise<ListResult> {
  const { data, error } = await supabase.functions.invoke("waiter-orders", {
    body: { action: "list", flyer_id: flyerId, pin },
  });
  if (error || (data as { error?: string })?.error) {
    throw new Error((data as { error?: string })?.error || error?.message || "Could not load orders");
  }
  return data as ListResult;
}

async function edgeVerify(flyerId: string, pin: string): Promise<WaiterPortalWaiter> {
  const { data, error } = await supabase.functions.invoke("waiter-master-auth", {
    body: { action: "waiter_verify", flyer_id: flyerId, pin },
  });
  if (error || !(data as { ok?: boolean })?.ok) {
    throw new Error("PIN not recognized");
  }
  return (data as { waiter: WaiterPortalWaiter }).waiter;
}

export async function waiterPortalList(flyerId: string, pin: string): Promise<ListResult> {
  const rpc = await rpcWaiterPortal(flyerId, pin, "list");
  if (rpc && "waiter" in rpc) return rpc;
  return edgeList(flyerId, pin);
}

export async function waiterPortalLogin(flyerId: string, pin: string): Promise<WaiterPortalWaiter> {
  const list = await waiterPortalList(flyerId, pin);
  return list.waiter;
}

export async function waiterPortalUpdateStatus(
  flyerId: string,
  pin: string,
  orderId: string,
  status: string,
): Promise<void> {
  const rpc = await rpcWaiterPortal(flyerId, pin, "update_status", { orderId, status });
  if (rpc && "ok" in rpc) return;
  const { data, error } = await supabase.functions.invoke("waiter-orders", {
    body: { action: "update_status", flyer_id: flyerId, pin, order_id: orderId, status },
  });
  if (error || (data as { error?: string })?.error) {
    throw new Error((data as { error?: string })?.error || error?.message || "Failed");
  }
}

export async function waiterPortalMarkPaid(
  flyerId: string,
  pin: string,
  orderId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("waiter_portal_rpc", {
    p_flyer_id: flyerId,
    p_pin: pin,
    p_action: "mark_paid",
    p_order_id: orderId,
    p_status: null,
  });

  if (!error && data && typeof data === "object" && "ok" in (data as object)) return;

  const rpcErr =
    data && typeof data === "object" && "error" in (data as object)
      ? String((data as { error: string }).error)
      : error?.message || "";

  if (rpcErr === "unknown action" || rpcErr === "RPC_MISSING" || error?.message?.includes("Could not find the function")) {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke("waiter-orders", {
      body: { action: "mark_paid", flyer_id: flyerId, pin, order_id: orderId },
    });
    if (!edgeErr && (edgeData as { ok?: boolean })?.ok) return;
    throw new Error(
      "Mark paid needs a DB update — run scripts/setup-menu-payment-dev.sql in Supabase SQL Editor, then try again.",
    );
  }

  if (rpcErr) throw new Error(rpcErr);
}

export async function resolveWaiterPortalToken(token: string): Promise<{ flyerId: string; title: string }> {
  const { data, error } = await supabase.rpc("waiter_portal_resolve_token", { p_token: token });
  if (error?.message?.includes("Could not find the function")) {
    throw new Error("RUN_RPC_SQL");
  }
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new Error(String((data as { error: string }).error));
  }
  const row = data as { flyer_id?: string; title?: string };
  if (!row?.flyer_id) throw new Error("invalid token");
  return { flyerId: row.flyer_id, title: row.title || "Flyer" };
}
