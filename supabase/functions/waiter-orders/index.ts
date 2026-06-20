// Waiter portal proxy: list & update orders for a waiter, verified by PIN each call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sha(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const hash = (flyerId: string, pin: string) => sha(`${flyerId}::${pin}::tap-that-flyer`);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function verifyWaiter(flyer_id: string, pin: string) {
  const h = await hash(flyer_id, pin);
  const { data } = await supabase.from("waiters").select("id, name, color, active").eq("flyer_id", flyer_id).eq("pin_hash", h).maybeSingle();
  if (!data || !data.active) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, flyer_id, pin, order_id, status } = body || {};
    if (!flyer_id || !pin) return json({ error: "missing flyer_id/pin" }, 400);
    const waiter = await verifyWaiter(flyer_id, pin);
    if (!waiter) return json({ error: "invalid pin" }, 401);

    // tables assigned to this waiter
    const { data: assigns } = await supabase.from("table_assignments").select("table_number").eq("flyer_id", flyer_id).eq("waiter_id", waiter.id);
    const tables = (assigns || []).map((a) => a.table_number);

    if (action === "list") {
      if (tables.length === 0) return json({ waiter, orders: [], tables: [] });
      const { data, error } = await supabase.from("menu_orders")
        .select("*")
        .eq("flyer_id", flyer_id)
        .is("archived_at", null)
        .in("table_number", tables)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ waiter, tables, orders: data || [] });
    }
    if (action === "update_status") {
      if (!order_id || !status) return json({ error: "missing" }, 400);
      // confirm order belongs to one of waiter's tables
      const { data: ord } = await supabase.from("menu_orders").select("table_number, flyer_id").eq("id", order_id).maybeSingle();
      if (!ord || ord.flyer_id !== flyer_id || !tables.includes(ord.table_number || "")) return json({ error: "not your table" }, 403);
      const { error } = await supabase.from("menu_orders").update({ status }).eq("id", order_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "mark_paid") {
      if (!order_id) return json({ error: "missing order_id" }, 400);
      const { data: ord } = await supabase.from("menu_orders").select("table_number, flyer_id").eq("id", order_id).maybeSingle();
      if (!ord || ord.flyer_id !== flyer_id || !tables.includes(ord.table_number || "")) return json({ error: "not your table" }, 403);
      const patch: Record<string, string> = { payment_status: "paid", paid_at: new Date().toISOString() };
      let { error } = await supabase.from("menu_orders").update(patch).eq("id", order_id);
      if (error?.message?.toLowerCase().includes("paid_at")) {
        ({ error } = await supabase.from("menu_orders").update({ payment_status: "paid" }).eq("id", order_id));
      }
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
