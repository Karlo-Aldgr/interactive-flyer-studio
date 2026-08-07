import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FlyerPortalView, type Appointment, type Subscriber, type FormSubmission, type PollVote, type AnalyticsEvent, type OrderStatus } from "@/components/portal/FlyerPortalView";

function getPortalDevice(): "mobile" | "tablet" | "desktop" {
  try {
    const ua = navigator.userAgent || "";
    if (/iPad|Tablet|PlayBook|Silk|(?=.*\bAndroid\b)(?!.*\bMobile\b)/i.test(ua)) return "tablet";
    if (/Mobi|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
    return "desktop";
  } catch { return "desktop"; }
}

export default function FlyerPortal() {
  const { flyerId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [flyerInfo, setFlyerInfo] = useState<{
    id: string;
    title: string;
    status?: string | null;
    public_slug?: string | null;
    thumbnail_url?: string | null;
    created_at?: string;
    chatbot_knowledge?: string | null;
    owner_id?: string | null;
  } | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [layers, setLayers] = useState<any[]>([]);

  const loadData = useCallback(async (showSpinner = true) => {
    if (!user || !flyerId) return;
    if (showSpinner) setLoading(true);
    const { data: flyer } = await supabase
      .from("flyers")
      .select("id, title, owner_id, status, public_slug, thumbnail_url, created_at, chatbot_knowledge")
      .eq("id", flyerId)
      .maybeSingle();

    if (!flyer || flyer.owner_id !== user.id) {
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roles) { setAuthorized(false); setLoading(false); return; }
    }
    setAuthorized(true);
    setFlyerInfo({
      id: flyer?.id || flyerId,
      title: flyer?.title || "Flyer",
      status: (flyer as any)?.status,
      public_slug: (flyer as any)?.public_slug ?? null,
      thumbnail_url: (flyer as any)?.thumbnail_url ?? null,
      created_at: (flyer as any)?.created_at,
      chatbot_knowledge: (flyer as any)?.chatbot_knowledge ?? null,
      owner_id: (flyer as any)?.owner_id ?? null,
    });

    const { data: pageRows } = await supabase.from("pages").select("id").eq("flyer_id", flyerId);
    const pageIds = (pageRows || []).map((p: any) => p.id);
    let layerRows: any[] = [];
    let actionRows: any[] = [];
    if (pageIds.length) {
      const { data: lr } = await supabase.from("layers").select("id, type, content").in("page_id", pageIds);
      layerRows = lr || [];
      const layerIds = layerRows.map((l) => l.id);
      if (layerIds.length) {
        const { data: ar } = await supabase.from("actions").select("id, type, payload, layer_id").in("layer_id", layerIds);
        actionRows = ar || [];
      }
    }

    const [{ data: ap }, { data: sub }, { data: sm }, { data: pv }, { data: ev }] = await Promise.all([
      supabase.from("appointments").select("*").eq("flyer_id", flyerId).order("start_at", { ascending: true }),
      supabase.from("subscribers").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("form_submissions").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("poll_votes").select("*").eq("flyer_id", flyerId),
      supabase.from("analytics_events").select("id, event_type, layer_id, session_id, created_at, metadata").eq("flyer_id", flyerId).order("created_at", { ascending: false }).limit(5000),
    ]);

    setAppointments((ap as Appointment[]) || []);
    setSubscribers((sub as Subscriber[]) || []);
    setSubmissions((sm as FormSubmission[]) || []);
    setPollVotes((pv as PollVote[]) || []);
    setEvents((ev as AnalyticsEvent[]) || []);
    setActions(actionRows);
    setLayers(layerRows);
    setLoading(false);
  }, [user, flyerId]);

  useEffect(() => { loadData(true); }, [loadData]);

  async function logPortalEvent(actionType: string, extra: Record<string, any> = {}, eventType: "view" | "click" = "click") {
    if (!flyerId) return;
    try {
      await supabase.from("analytics_events").insert([{
        flyer_id: flyerId,
        event_type: eventType as any,
        metadata: { action_type: actionType, source: "portal", device: getPortalDevice(), ...extra } as any,
      } as any]);
    } catch (e) { console.warn("portal analytics insert failed", e); }
  }

  async function setOrderStatus(id: string, status: OrderStatus, extraData?: Record<string, any>) {
    const target = submissions.find((s) => s.id === id);
    const wasPayLater = target?.status === "pay_later";
    const nextData = extraData ? { ...(target?.data || {}), ...extraData } : target?.data;
    const prev = submissions;
    setSubmissions((arr) => arr.map((s) => (s.id === id ? { ...s, status, data: nextData ?? s.data } : s)));
    const payload: any = { status };
    if (extraData) payload.data = nextData;
    const { error } = await supabase.from("form_submissions").update(payload).eq("id", id);
    if (error) { setSubmissions(prev); toast.error(error.message); return false; }
    toast.success("Status updated");
    if (wasPayLater && status === "completed") logPortalEvent("pay_later_paid", { order_id: id, paid_by: extraData?.paid_by });
    return true;
  }

  async function cancelAppointment(id: string): Promise<void> {
    if (!confirm("Cancel this appointment?")) return;
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAppointments((arr) => arr.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
    toast.success("Cancelled");
  }

  async function saveChatbotKnowledge(text: string) {
    if (!flyerId) return;
    const { error } = await supabase
      .from("flyers")
      .update({ chatbot_knowledge: text || null })
      .eq("id", flyerId);
    if (error) throw new Error(error.message);
    setFlyerInfo((prev) => (prev ? { ...prev, chatbot_knowledge: text || null } : prev));
  }

  if (!user) return <div className="p-8">Please sign in.</div>;
  if (loading || !flyerInfo) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="font-display text-lg font-semibold text-foreground animate-pulse">
        We Are Loading Your Experience
      </div>
    </div>
  );
  if (!authorized) return <div className="p-8 text-destructive">Not authorized.</div>;

  return (
    <FlyerPortalView
      flyer={flyerInfo}
      events={events}
      subscribers={subscribers}
      appointments={appointments}
      submissions={submissions}
      pollVotes={pollVotes}
      actions={actions}
      layers={layers}
      mode="owner"
      userEmail={user.email || user.id}
      onRefresh={() => loadData(false)}
      onCancelAppointment={cancelAppointment}
      onSetOrderStatus={setOrderStatus}
      onLogPortalEvent={logPortalEvent}
      onSaveChatbotKnowledge={saveChatbotKnowledge}
    />
  );
}
