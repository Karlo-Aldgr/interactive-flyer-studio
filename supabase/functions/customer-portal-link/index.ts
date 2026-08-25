// Authenticated: return one-click portal credentials for a customer's flyer.
// Uses service role so job customers can access portal links without DB migrations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function userCanAccessFlyerPortal(
  admin: ReturnType<typeof createClient>,
  userId: string,
  flyerId: string,
): Promise<boolean> {
  const { data: flyer } = await admin
    .from("flyers")
    .select("owner_id")
    .eq("id", flyerId)
    .maybeSingle();
  if (flyer?.owner_id === userId) return true;

  const { data: job } = await admin
    .from("jobs")
    .select("id")
    .eq("flyer_id", flyerId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or("share_unlocked.eq.true,status.in.(paid,completed,delivered)")
    .limit(1)
    .maybeSingle();

  return !!job;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const { flyer_id } = await req.json().catch(() => ({}));
    if (!flyer_id) return json({ error: "Missing flyer_id" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json({ error: "Authentication required" }, 401);

    const allowed = await userCanAccessFlyerPortal(admin, user.id, flyer_id);
    if (!allowed) return json({ error: "Permission denied" }, 403);

    const { error: insertErr } = await admin
      .from("flyer_portal_credentials")
      .upsert({ flyer_id }, { onConflict: "flyer_id", ignoreDuplicates: true });
    if (insertErr) return json({ error: insertErr.message }, 500);

    const { data: cred, error: credErr } = await admin
      .from("flyer_portal_credentials")
      .select("portal_token, portal_access_code")
      .eq("flyer_id", flyer_id)
      .maybeSingle();

    if (credErr) return json({ error: credErr.message }, 500);
    if (!cred?.portal_token || !cred?.portal_access_code) {
      return json({ error: "Portal link not available" }, 404);
    }

    return json({
      portal_token: cred.portal_token,
      portal_access_code: cred.portal_access_code,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
