// Public edge function — validates portal token + access code and returns
// the flyer's portal data (analytics, subscribers, appointments, polls, forms).
// Deployed with verify_jwt = false so anyone with the link + code can access.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { token, code } = await req.json().catch(() => ({}));
    if (!token || !code) {
      return json({ error: "Missing token or code" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: flyer, error: flyerErr } = await supabase
      .from("flyers")
      .select("id, title, status, public_slug, settings, thumbnail_url, created_at, portal_access_code")
      .eq("portal_token", token)
      .maybeSingle();

    if (flyerErr) return json({ error: flyerErr.message }, 500);
    if (!flyer) return json({ error: "Invalid link" }, 404);
    if (String(code).trim().toUpperCase() !== String(flyer.portal_access_code).toUpperCase()) {
      return json({ error: "Invalid access code" }, 401);
    }

    const flyerId = flyer.id as string;

    // Discover which action types & hotspots exist in this flyer so the portal
    // can render only the tabs that match what was actually built.
    const { data: pages } = await supabase.from("pages").select("id").eq("flyer_id", flyerId);
    const pageIds = (pages || []).map((p: any) => p.id);
    let actions: any[] = [];
    let layers: any[] = [];
    if (pageIds.length) {
      const { data: layersData } = await supabase
        .from("layers")
        .select("id, type, content")
        .in("page_id", pageIds);
      layers = layersData || [];
      const layerIds = layers.map((l: any) => l.id);
      if (layerIds.length) {
        const { data: actionsData } = await supabase
          .from("actions")
          .select("id, type, payload, layer_id")
          .in("layer_id", layerIds);
        actions = actionsData || [];
      }
    }

    // Collect every action type across top-level actions AND nested popup buttons/hotspots
    const actionTypes = new Set<string>();
    for (const a of actions) {
      if (a.type) actionTypes.add(a.type);
      const p = a.payload || {};
      for (const b of p.buttons || []) if (b?.action?.type) actionTypes.add(b.action.type);
      for (const h of p.hotspots || []) if (h?.action?.type) actionTypes.add(h.action.type);
    }
    const hasHotspotLayers = layers.some((l: any) => l.type === "hotspot");

    const [
      { data: subscribers },
      { data: appointments },
      { data: submissions },
      { data: pollVotes },
      { data: events },
      { count: viewsCount },
    ] = await Promise.all([
      supabase.from("subscribers").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("flyer_id", flyerId).order("start_at", { ascending: true }),
      supabase.from("form_submissions").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("poll_votes").select("*").eq("flyer_id", flyerId),
      supabase.from("analytics_events").select("event_type, created_at, metadata, layer_id").eq("flyer_id", flyerId).order("created_at", { ascending: false }).limit(2000),
      supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("flyer_id", flyerId).eq("event_type", "view"),
    ]);

    // Aggregate purchases / clicks from analytics_events metadata when present
    const purchases = (events || []).filter((e: any) => {
      const t = (e.event_type || "").toLowerCase();
      const meta = e.metadata || {};
      return t === "purchase" || t === "checkout" || meta.purchase === true;
    });

    return json({
      flyer: {
        id: flyer.id,
        title: flyer.title,
        status: flyer.status,
        public_slug: flyer.public_slug,
        thumbnail_url: flyer.thumbnail_url,
        created_at: flyer.created_at,
      },
      counts: {
        views: viewsCount ?? 0,
        subscribers: (subscribers || []).length,
        appointments: (appointments || []).length,
        submissions: (submissions || []).length,
        pollVotes: (pollVotes || []).length,
        purchases: purchases.length,
      },
      subscribers: subscribers || [],
      appointments: appointments || [],
      submissions: submissions || [],
      pollVotes: pollVotes || [],
      events: events || [],
      features: {
        actionTypes: Array.from(actionTypes),
        hasHotspots: hasHotspotLayers,
        hasAppointments: actionTypes.has("book_appointment"),
        hasSubscribe: actionTypes.has("subscribe"),
        hasForms: actionTypes.has("form") || actionTypes.has("rsvp"),
        hasPolls: actionTypes.has("poll"),
        hasCheckout: actionTypes.has("checkout") || actionTypes.has("buy_ticket") || actionTypes.has("buy_product"),
        hasCalls: actionTypes.has("call") || actionTypes.has("sms"),
      },
      actions: actions.map((a: any) => ({ id: a.id, type: a.type, layer_id: a.layer_id })),
    });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
