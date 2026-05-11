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
      supabase.from("analytics_events").select("event_type, created_at, metadata, layer_id, session_id").eq("flyer_id", flyerId).order("created_at", { ascending: false }).limit(5000),
      supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("flyer_id", flyerId).eq("event_type", "view"),
    ]);

    // ---- Visitor analytics ----
    const viewEvents = (events || []).filter((e: any) => e.event_type === "view");
    const clickEvents = (events || []).filter((e: any) => e.event_type === "click");
    const sessionViews: Record<string, number> = {};
    for (const e of viewEvents) {
      const sid = e.session_id || `anon-${e.created_at}`;
      sessionViews[sid] = (sessionViews[sid] || 0) + 1;
    }
    const uniqueVisitors = Object.keys(sessionViews).length;
    const returnVisitors = Object.values(sessionViews).filter((n) => n > 1).length;

    // Build a layer label map (best-effort) so hotspot clicks show meaningful names
    const layerLabel: Record<string, { label: string; type: string }> = {};
    for (const l of layers) {
      const c = l.content || {};
      const label = c.text || c.label || c.iconName || c.url || `${l.type}`;
      layerLabel[l.id] = { label: String(label).slice(0, 60), type: l.type };
    }

    // Hotspot / layer click breakdown
    const layerClicks: Record<string, { layer_id: string; label: string; type: string; action_type: string | null; clicks: number }> = {};
    const actionTypeClicks: Record<string, number> = {};
    for (const e of clickEvents) {
      const lid = e.layer_id || "_none";
      const at = (e.metadata?.action_type as string) || null;
      const meta = layerLabel[lid] || { label: lid === "_none" ? "(no layer)" : lid, type: "?" };
      const key = `${lid}|${at || ""}`;
      if (!layerClicks[key]) {
        layerClicks[key] = { layer_id: lid, label: meta.label, type: meta.type, action_type: at, clicks: 0 };
      }
      layerClicks[key].clicks += 1;
      if (at) actionTypeClicks[at] = (actionTypeClicks[at] || 0) + 1;
    }
    const topLayerClicks = Object.values(layerClicks).sort((a, b) => b.clicks - a.clicks);

    // Daily views (last 30 days bucketed by yyyy-mm-dd)
    const dailyViewsMap: Record<string, number> = {};
    for (const e of viewEvents) {
      const d = new Date(e.created_at).toISOString().slice(0, 10);
      dailyViewsMap[d] = (dailyViewsMap[d] || 0) + 1;
    }
    const dailyViews = Object.entries(dailyViewsMap)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-30)
      .map(([date, count]) => ({ date, count }));

    // Cart orders & customer emails (stored as form_submissions with kind=cart_order)
    const cartOrders = (submissions || []).filter((s: any) => s?.data?.kind === "cart_order");
    const cartEmails = cartOrders.map((s: any) => ({
      created_at: s.created_at,
      name: s.data?.customer?.name || null,
      email: s.data?.customer?.email || null,
      phone: s.data?.customer?.phone || null,
      address: s.data?.customer?.address || null,
      total: s.data?.total ?? null,
      currency: s.data?.currency || null,
      items: (s.data?.items || []).length,
    })).filter((r: any) => r.email);
    const cartTotal = cartOrders.reduce((sum: number, s: any) => sum + (Number(s.data?.total) || 0), 0);

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
        uniqueVisitors,
        returnVisitors,
        clicks: clickEvents.length,
        subscribers: (subscribers || []).length,
        appointments: (appointments || []).length,
        submissions: (submissions || []).length,
        pollVotes: (pollVotes || []).length,
        purchases: purchases.length,
        cartOrders: cartOrders.length,
        cartRevenue: cartTotal,
      },
      analytics: {
        dailyViews,
        topLayerClicks,
        actionTypeClicks,
      },
      cartEmails,
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
      actions: actions.map((a: any) => ({ id: a.id, type: a.type, payload: a.payload, layer_id: a.layer_id })),
      layers: layers.map((l: any) => ({ id: l.id, type: l.type, content: l.content })),
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
