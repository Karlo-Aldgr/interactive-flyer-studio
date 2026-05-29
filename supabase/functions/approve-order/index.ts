// Manager approves/rejects an order_ahead order. Caller must be flyer owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "auth required" }, 401);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "auth required" }, 401);

    const { order_id, decision } = await req.json();
    if (!order_id || !["approve", "reject"].includes(decision)) return json({ error: "bad input" }, 400);

    const { data: ord } = await supabase.from("menu_orders").select("flyer_id, status").eq("id", order_id).maybeSingle();
    if (!ord) return json({ error: "not found" }, 404);
    const { data: flyer } = await supabase.from("flyers").select("owner_id").eq("id", ord.flyer_id).maybeSingle();
    if (!flyer || flyer.owner_id !== user.id) return json({ error: "not owner" }, 403);

    const newStatus = decision === "approve" ? "new" : "cancelled";
    const patch: Record<string, unknown> = { status: newStatus };
    if (decision === "approve") { patch.approved_by = user.id; patch.approved_at = new Date().toISOString(); }
    const { error } = await supabase.from("menu_orders").update(patch).eq("id", order_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
