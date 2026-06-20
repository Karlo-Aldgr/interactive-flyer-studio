// Public edge function — customer order lookup by id + email/phone (no auth).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  kind?: "cart" | "menu";
  orderId?: string;
  email?: string;
  phone?: string;
};

function normEmail(s: string) {
  return s.trim().toLowerCase();
}

function normPhone(s: string) {
  return s.replace(/\D/g, "");
}

function cartPhase(status: string): "pending" | "in_production" | "complete" {
  const s = (status || "new").toLowerCase();
  if (s === "completed") return "complete";
  if (s === "in_production") return "in_production";
  return "pending";
}

function menuPhase(status: string): "pending" | "in_production" | "served" | "complete" {
  const s = (status || "new").toLowerCase();
  if (s === "completed") return "complete";
  if (s === "served") return "served";
  if (s === "preparing" || s === "in_production") return "in_production";
  if (s === "cancelled" || s === "rejected") return "complete";
  return "pending";
}

function menuPhaseLabel(phase: ReturnType<typeof menuPhase>): string {
  if (phase === "in_production") return "Preparing";
  if (phase === "served") return "Served";
  if (phase === "complete") return "Complete";
  return "Pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const orderId = body.orderId?.trim();
    const kind = body.kind;
    if (!orderId || !kind) {
      return json({ error: "Missing orderId or kind" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (kind === "cart") {
      const email = body.email ? normEmail(body.email) : "";
      const phone = body.phone ? normPhone(body.phone) : "";
      if (!email && !phone) {
        return json({ error: "Email or phone required" }, 400);
      }

      const { data: row, error } = await supabase
        .from("form_submissions")
        .select("id, status, created_at, updated_at, data")
        .eq("id", orderId)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!row || (row as any).data?.kind !== "cart_order") {
        return json({ error: "Order not found" }, 404);
      }

      const cust = (row as any).data?.customer || {};
      const rowEmail = cust.email ? normEmail(String(cust.email)) : "";
      const rowPhone = cust.phone ? normPhone(String(cust.phone)) : "";
      const emailOk = email && rowEmail && email === rowEmail;
      const phoneOk = phone && rowPhone && phone === rowPhone;
      if (!emailOk && !phoneOk) {
        return json({ error: "Order not found" }, 404);
      }

      const phase = cartPhase((row as any).status);
      return json({
        orderId: row.id,
        kind: "cart",
        status: (row as any).status,
        customerPhase: phase,
        customerLabel: phase === "pending" ? "Pending" : phase === "in_production" ? "In Production" : "Complete",
        items: (row as any).data?.items || [],
        total: (row as any).data?.total ?? null,
        currency: (row as any).data?.currency || null,
        customerName: cust.name || null,
        createdAt: (row as any).created_at,
        updatedAt: (row as any).updated_at,
      });
    }

    if (kind === "menu") {
      const phone = body.phone ? normPhone(body.phone) : "";
      const { data: row, error } = await supabase
        .from("menu_orders")
        .select("id, status, payment_status, payment_method, customer_name, customer_phone, items, subtotal_cents, table_number, order_type, created_at, updated_at")
        .eq("id", orderId)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!row) return json({ error: "Order not found" }, 404);

      const rowPhone = (row as any).customer_phone ? normPhone(String((row as any).customer_phone)) : "";
      if (phone && rowPhone && phone !== rowPhone) {
        return json({ error: "Order not found" }, 404);
      }

      const phase = menuPhase((row as any).status);
      return json({
        orderId: row.id,
        kind: "menu",
        status: (row as any).status,
        paymentStatus: (row as any).payment_status || "unpaid",
        paymentMethod: (row as any).payment_method || "pay_later",
        customerPhase: phase,
        customerLabel: menuPhaseLabel(phase),
        items: (row as any).items || [],
        total: ((row as any).subtotal_cents || 0) / 100,
        currency: "$",
        customerName: (row as any).customer_name,
        tableNumber: (row as any).table_number,
        createdAt: (row as any).created_at,
        updatedAt: (row as any).updated_at,
      });
    }

    return json({ error: "Invalid kind" }, 400);
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
