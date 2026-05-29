// Handles PIN setup & verification for waiters and master (owner) PINs.
// Uses service role to bypass RLS. Hashing: SHA-256 with per-flyer salt (PIN context).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, flyer_id, pin, new_pin, waiter_id, name, color } = body || {};
    if (!action || !flyer_id) return json({ error: "missing params" }, 400);

    // ----- MASTER (owner) PIN flows -----
    if (action === "master_set" || action === "master_change") {
      // Require an authenticated owner — verify via Authorization header
      const auth = req.headers.get("authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "auth required" }, 401);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return json({ error: "auth required" }, 401);
      const { data: flyer } = await supabase.from("flyers").select("owner_id").eq("id", flyer_id).maybeSingle();
      if (!flyer || flyer.owner_id !== user.id) return json({ error: "not owner" }, 403);
      if (!new_pin || String(new_pin).length < 4) return json({ error: "pin too short" }, 400);
      const h = await hash(flyer_id, String(new_pin));
      const { error } = await supabase.from("flyer_master_auth").upsert({ flyer_id, master_pin_hash: h });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "master_verify") {
      if (!pin) return json({ error: "pin required" }, 400);
      const { data } = await supabase.from("flyer_master_auth").select("master_pin_hash").eq("flyer_id", flyer_id).maybeSingle();
      if (!data) return json({ ok: false, reason: "not_set" });
      const h = await hash(flyer_id, String(pin));
      return json({ ok: h === data.master_pin_hash });
    }
    if (action === "master_status") {
      const { data } = await supabase.from("flyer_master_auth").select("flyer_id").eq("flyer_id", flyer_id).maybeSingle();
      return json({ set: !!data });
    }

    // ----- WAITER flows -----
    if (action === "waiter_create") {
      const auth = req.headers.get("authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return json({ error: "auth required" }, 401);
      const { data: flyer } = await supabase.from("flyers").select("owner_id").eq("id", flyer_id).maybeSingle();
      if (!flyer || flyer.owner_id !== user.id) return json({ error: "not owner" }, 403);
      if (!name || !new_pin) return json({ error: "missing" }, 400);
      const h = await hash(flyer_id, String(new_pin));
      const { data, error } = await supabase.from("waiters").insert({ flyer_id, name, color: color || "#3b82f6", pin_hash: h }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ waiter: data });
    }
    if (action === "waiter_set_pin") {
      const auth = req.headers.get("authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return json({ error: "auth required" }, 401);
      const { data: flyer } = await supabase.from("flyers").select("owner_id").eq("id", flyer_id).maybeSingle();
      if (!flyer || flyer.owner_id !== user.id) return json({ error: "not owner" }, 403);
      if (!waiter_id || !new_pin) return json({ error: "missing" }, 400);
      const h = await hash(flyer_id, String(new_pin));
      const { error } = await supabase.from("waiters").update({ pin_hash: h }).eq("id", waiter_id).eq("flyer_id", flyer_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "waiter_verify") {
      if (!pin) return json({ error: "pin required" }, 400);
      const h = await hash(flyer_id, String(pin));
      const { data } = await supabase.from("waiters").select("id, name, color, active").eq("flyer_id", flyer_id).eq("pin_hash", h).maybeSingle();
      if (!data || !data.active) return json({ ok: false });
      return json({ ok: true, waiter: { id: data.id, name: data.name, color: data.color } });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
