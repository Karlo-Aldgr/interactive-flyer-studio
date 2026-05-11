import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type OrderStatus = "new" | "on_hold" | "pay_later" | "completed";
const ORDER_STATUSES: { value: OrderStatus; label: string; cls: string; ring: string }[] = [
  { value: "new",        label: "New",        cls: "bg-primary text-primary-foreground",                    ring: "border-primary/60 bg-primary/5" },
  { value: "on_hold",    label: "On Hold",    cls: "bg-amber-500 text-white",                                ring: "border-amber-500/50 bg-amber-500/5" },
  { value: "pay_later",  label: "Pay Later",  cls: "bg-red-600 text-white animate-pulse",                    ring: "border-red-600 bg-red-500/10" },
  { value: "completed",  label: "Completed",  cls: "bg-emerald-600 text-white",                              ring: "border-emerald-600/40 bg-emerald-600/5" },
];
const statusMeta = (s: string | null | undefined) =>
  ORDER_STATUSES.find((x) => x.value === (s as OrderStatus)) || ORDER_STATUSES[0];

interface Appointment {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  note: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  status: "confirmed" | "cancelled";
  metadata: any;
  created_at: string;
}

interface Subscriber {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  list_name: string | null;
  created_at: string;
}

interface FormSubmission {
  id: string;
  data: any;
  status: string | null;
  created_at: string;
  layer_id?: string | null;
}

interface PollVote {
  id: string;
  action_id: string;
  option_id: string;
  session_id: string;
  created_at: string;
}

interface AnalyticsEvent {
  id: string;
  event_type: string;
  layer_id: string | null;
  session_id: string | null;
  created_at: string;
  metadata: any;
}

function csv(rows: any[], cols: string[]): string {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FlyerPortal() {
  const { flyerId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [flyerTitle, setFlyerTitle] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [layers, setLayers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [calDate, setCalDate] = useState<Date | undefined>();

  const loadData = useCallback(async (showSpinner = true) => {
    if (!user || !flyerId) return;
    if (showSpinner) setLoading(true);
    const { data: flyer } = await supabase
      .from("flyers")
      .select("id, title, owner_id")
      .eq("id", flyerId)
      .maybeSingle();

    if (!flyer || flyer.owner_id !== user.id) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roles) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
    }
    setAuthorized(true);
    setFlyerTitle(flyer?.title || "Flyer");

    const { data: pageRows } = await supabase.from("pages").select("id").eq("flyer_id", flyerId);
    const pageIds = (pageRows || []).map((p: any) => p.id);
    let layerRows: any[] = [];
    let actionRows: any[] = [];
    if (pageIds.length) {
      const { data: lr } = await supabase.from("layers").select("id, type, content").in("page_id", pageIds);
      layerRows = lr || [];
      const layerIds = layerRows.map((l) => l.id);
      if (layerIds.length) {
        const { data: ar } = await supabase
          .from("actions")
          .select("id, type, payload, layer_id")
          .in("layer_id", layerIds);
        actionRows = ar || [];
      }
    }

    const [{ data: ap }, { data: sub }, { data: sm }, { data: pv }, { data: ev }] = await Promise.all([
      supabase.from("appointments").select("*").eq("flyer_id", flyerId).order("start_at", { ascending: true }),
      supabase.from("subscribers").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("form_submissions").select("*").eq("flyer_id", flyerId).order("created_at", { ascending: false }),
      supabase.from("poll_votes").select("*").eq("flyer_id", flyerId),
      supabase
        .from("analytics_events")
        .select("id, event_type, layer_id, session_id, created_at, metadata")
        .eq("flyer_id", flyerId)
        .order("created_at", { ascending: false })
        .limit(5000),
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

  // Build polls from actions (top-level + nested in popup buttons/hotspots)
  const polls = useMemo(() => {
    const out: { actionId: string; question: string; options: { id: string; label: string }[] }[] = [];
    const collect = (a: any) => {
      if (!a) return;
      if (a.type === "poll" && a.payload) {
        out.push({
          actionId: a.id || a.actionId,
          question: a.payload.question || a.payload.title || "Poll",
          options: (a.payload.options || []).map((o: any) => ({
            id: String(o.id ?? o.value ?? o.label),
            label: o.label || o.text || String(o.value || o.id),
          })),
        });
      }
    };
    for (const a of actions) {
      collect(a);
      const p = a.payload || {};
      for (const b of p.buttons || []) if (b?.action) collect({ id: a.id, ...b.action });
      for (const h of p.hotspots || []) if (h?.action) collect({ id: a.id, ...h.action });
    }
    return out;
  }, [actions]);

  // Every action type used in this flyer (top-level + popup buttons + hotspots)
  const allActionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const a of actions) {
      if (a.type) set.add(a.type);
      const p = a.payload || {};
      for (const b of p.buttons || []) if (b?.action?.type) set.add(b.action.type);
      for (const h of p.hotspots || []) if (h?.action?.type) set.add(h.action.type);
    }
    return Array.from(set);
  }, [actions]);

  const ACTION_LABELS: Record<string, string> = {
    open_url: "Links", call: "Calls", sms: "SMS", email: "Emails",
    share: "Shares", coupon: "Coupons", download: "Downloads",
    map: "Map", directions: "Directions", video: "Videos", audio: "Audio",
    popup: "Popups", lightbox: "Lightbox", navigate: "Navigation",
    add_to_calendar: "Calendar adds", social: "Social",
  };
  const COVERED_ACTION_TYPES = new Set([
    "poll", "book_appointment", "subscribe", "form", "rsvp",
    "checkout", "buy_ticket", "buy_product",
  ]);
  const extraActionTypes = allActionTypes.filter((t) => !COVERED_ACTION_TYPES.has(t));

  const layerLabel = useMemo(() => {
    const m: Record<string, { label: string; type: string }> = {};
    for (const l of layers) {
      const c = l.content || {};
      const label = c.text || c.label || c.iconName || c.url || l.type;
      m[l.id] = { label: String(label).slice(0, 60), type: l.type };
    }
    return m;
  }, [layers]);

  const viewEvents = events.filter((e) => e.event_type === "view");
  const clickEvents = events.filter((e) => e.event_type === "click");
  const sessionViews: Record<string, number> = {};
  for (const e of viewEvents) {
    const sid = e.session_id || `anon-${e.created_at}`;
    sessionViews[sid] = (sessionViews[sid] || 0) + 1;
  }
  const uniqueVisitors = Object.keys(sessionViews).length;
  const returnVisitors = Object.values(sessionViews).filter((n) => n > 1).length;

  const layerClicks: Record<string, { label: string; type: string; clicks: number }> = {};
  for (const e of clickEvents) {
    const lid = e.layer_id || "_none";
    const meta = layerLabel[lid] || { label: lid === "_none" ? "(no layer)" : lid, type: "?" };
    if (!layerClicks[lid]) layerClicks[lid] = { ...meta, clicks: 0 };
    layerClicks[lid].clicks += 1;
  }
  const topLayerClicks = Object.entries(layerClicks)
    .map(([lid, v]) => ({ lid, ...v }))
    .sort((a, b) => b.clicks - a.clicks);

  const dailyViewsMap: Record<string, number> = {};
  for (const e of viewEvents) {
    const d = new Date(e.created_at).toISOString().slice(0, 10);
    dailyViewsMap[d] = (dailyViewsMap[d] || 0) + 1;
  }
  const dailyViews = Object.entries(dailyViewsMap).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-30);
  const maxDaily = Math.max(1, ...dailyViews.map(([, c]) => c));

  const payLaterOrderIds = new Set(
    submissions
      .filter((s) => s?.data?.kind === "cart_pay_later" && s?.data?.order_id)
      .map((s) => s.data.order_id as string)
  );
  const cartOrders = submissions
    .filter((s) => s?.data?.kind === "cart_order")
    .map((s) => {
      // Pay-later marker overrides any other status (unless owner already completed it)
      const isPayLater = payLaterOrderIds.has(s.id);
      const effective: OrderStatus =
        isPayLater && s.status !== "completed" ? "pay_later" : ((s.status as OrderStatus) || "new");
      return { ...s, status: effective, _payLater: isPayLater };
    });
  const cartCounts: Record<OrderStatus, number> = { new: 0, on_hold: 0, pay_later: 0, completed: 0 };
  for (const o of cartOrders) {
    const s = (o.status as OrderStatus) || "new";
    if (cartCounts[s] != null) cartCounts[s] += 1;
  }
  const [openOrder, setOpenOrder] = useState<FormSubmission | null>(null);

  async function setOrderStatus(id: string, status: OrderStatus) {
    const prev = submissions;
    setSubmissions((arr) => arr.map((s) => (s.id === id ? { ...s, status } : s)));
    setOpenOrder((o) => (o && o.id === id ? { ...o, status } : o));
    const { error } = await supabase.from("form_submissions").update({ status } as any).eq("id", id);
    if (error) {
      setSubmissions(prev);
      toast.error(error.message);
    } else {
      toast.success("Status updated");
    }
  }

  async function cancelAppointment(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    setAppointments((arr) => arr.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
    toast.success("Cancelled");
  }

  if (!user) return <div className="p-8">Please sign in.</div>;
  if (loading) return <div className="flex items-center gap-2 p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!authorized) return <div className="p-8 text-destructive">Not authorized.</div>;

  const filtered = (arr: any[]) =>
    arr.filter((r) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return [r.name, r.email, r.phone, r.note].filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
    });

  const apptDays = new Set(
    appointments.filter((a) => a.status === "confirmed").map((a) => new Date(a.start_at).toDateString())
  );
  const apptsForCalDate = calDate
    ? appointments.filter((a) => new Date(a.start_at).toDateString() === calDate.toDateString())
    : [];

  return (
    <div className="container mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/editor/${flyerId}`}><ChevronLeft className="mr-1 h-4 w-4" /> Editor</Link>
          </Button>
          <h1 className="text-xl font-semibold">{flyerTitle} — Portal</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={() => loadData(false)}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {[
          ["Views", viewEvents.length],
          ["Unique", uniqueVisitors],
          ["Return", returnVisitors],
          ["Clicks", clickEvents.length],
          ["Subs", subscribers.length],
          ["Cart", cartOrders.length],
        ].map(([label, val]) => (
          <Card key={label as string}><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold">{val as number}</div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="flex-wrap">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="polls">Polls ({polls.length})</TabsTrigger>
          <TabsTrigger value="appointments">Appointments ({appointments.length})</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers ({subscribers.length})</TabsTrigger>
          <TabsTrigger value="forms">Forms ({submissions.length})</TabsTrigger>
          <TabsTrigger value="cart">Cart ({cartOrders.length})</TabsTrigger>
          {extraActionTypes.map((t) => {
            const count = clickEvents.filter((e) => e?.metadata?.action_type === t).length;
            const label = ACTION_LABELS[t] || t.replace(/_/g, " ");
            return <TabsTrigger key={t} value={`act-${t}`} className="capitalize">{label} ({count})</TabsTrigger>;
          })}
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily views (last 30 days)</CardTitle></CardHeader>
            <CardContent>
              {dailyViews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No views yet.</p>
              ) : (
                <div className="flex h-32 items-end gap-1">
                  {dailyViews.map(([d, c]) => (
                    <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${c}`}>
                      <div className="w-full rounded-t bg-primary" style={{ height: `${(c / maxDaily) * 100}%` }} />
                      <div className="text-[9px] text-muted-foreground">{d.slice(5)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Hotspot / layer clicks</CardTitle></CardHeader>
            <CardContent>
              {topLayerClicks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clicks tracked yet.</p>
              ) : (
                <div className="space-y-1">
                  {topLayerClicks.map((r) => (
                    <div key={r.lid} className="flex items-center justify-between text-sm">
                      <span><Badge variant="secondary" className="mr-2">{r.type}</Badge>{r.label}</span>
                      <span className="font-mono">{r.clicks}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="polls" className="space-y-4">
          {polls.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No polls in this flyer.</CardContent></Card>
          ) : (
            polls.map((poll) => {
              const votes = pollVotes.filter((v) => v.action_id === poll.actionId);
              const total = votes.length;
              const counts: Record<string, number> = {};
              for (const v of votes) counts[v.option_id] = (counts[v.option_id] || 0) + 1;
              return (
                <Card key={poll.actionId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{poll.question}</CardTitle>
                    <p className="text-xs text-muted-foreground">{total} votes · {new Set(votes.map(v => v.session_id)).size} voters</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {poll.options.map((o) => {
                      const c = counts[o.id] || 0;
                      const pct = total ? Math.round((c / total) * 100) : 0;
                      return (
                        <div key={o.id}>
                          <div className="flex justify-between text-xs"><span>{o.label}</span><span>{c} ({pct}%)</span></div>
                          <Progress value={pct} />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Calendar</CardTitle></CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={calDate}
                  onSelect={setCalDate}
                  modifiers={{ booked: (d) => apptDays.has(d.toDateString()) }}
                  modifiersClassNames={{ booked: "bg-primary/20 font-bold" }}
                />
                {calDate && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium">{calDate.toDateString()}</p>
                    {apptsForCalDate.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No appointments.</p>
                    ) : (
                      apptsForCalDate.map((a) => (
                        <div key={a.id} className="text-xs">
                          {new Date(a.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {a.name || a.email}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">All bookings</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "appointments.csv",
                      csv(
                        appointments.map((a) => ({
                          start_at: a.start_at, end_at: a.end_at, name: a.name, email: a.email,
                          phone: a.phone, note: a.note, status: a.status, timezone: a.timezone,
                        })),
                        ["start_at", "end_at", "name", "email", "phone", "note", "status", "timezone"]
                      )
                    )
                  }
                >
                  <Download className="mr-1 h-3 w-3" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {filtered(appointments).map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                        <div>
                          <div className="font-medium">
                            {new Date(a.start_at).toLocaleString()}{" "}
                            {a.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.name || "—"} · {a.email} {a.phone && `· ${a.phone}`}
                          </div>
                          {a.note && <div className="text-xs italic text-muted-foreground">"{a.note}"</div>}
                        </div>
                        {a.status === "confirmed" && (
                          <Button size="sm" variant="ghost" onClick={() => cancelAppointment(a.id)}>Cancel</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscribers" className="space-y-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Subscribers</CardTitle>
              <Button
                size="sm" variant="outline"
                onClick={() => downloadCsv("subscribers.csv", csv(subscribers, ["created_at", "name", "email", "phone", "list_name"]))}
              >
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {subscribers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscribers yet.</p>
              ) : (
                <div className="space-y-1">
                  {filtered(subscribers).map((s) => (
                    <div key={s.id} className="text-sm">
                      <span className="font-medium">{s.name || "—"}</span> · {s.email} {s.phone && `· ${s.phone}`}
                      {s.list_name && <Badge variant="secondary" className="ml-2">{s.list_name}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="space-y-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Form submissions</CardTitle></CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((s) => (
                    <div key={s.id} className="rounded border border-border p-2 text-xs">
                      <div className="font-mono text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                      <pre className="mt-1 whitespace-pre-wrap break-words">{JSON.stringify(s.data, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cart" className="space-y-2">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Cart orders</CardTitle>
              <div className="flex flex-wrap items-center gap-1">
                {ORDER_STATUSES.map((s) => (
                  <Badge key={s.value} className={s.cls} variant="default">
                    {s.label}: {cartCounts[s.value]}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {cartOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cart orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {cartOrders.map((s) => {
                    const meta = statusMeta(s.status);
                    const phone = s.data?.customer?.phone;
                    const email = s.data?.customer?.email;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setOpenOrder(s)}
                        className={`w-full rounded border-l-4 ${meta.ring} border border-border p-2 text-left text-xs transition hover:bg-muted/50`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {s.data?.customer?.name || "—"} · {email || "—"} {phone && `· ${phone}`}
                            </div>
                            <div className="text-muted-foreground">
                              {new Date(s.created_at).toLocaleString()} · {(s.data?.items || []).length} items · {s.data?.currency || ""} {s.data?.total ?? ""}
                            </div>
                            {s.status === "pay_later" && (
                              <div className="mt-1 font-semibold text-red-600">
                                ⚠ Customer chose Pay Later — request payment now
                              </div>
                            )}
                          </div>
                          <Badge className={meta.cls}>{meta.label}</Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {extraActionTypes.map((t) => {
          const rows = clickEvents.filter((e) => e?.metadata?.action_type === t);
          const label = ACTION_LABELS[t] || t.replace(/_/g, " ");
          return (
            <TabsContent key={t} value={`act-${t}`} className="space-y-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm capitalize">{label} — {rows.length} interactions</CardTitle>
                  <Button
                    size="sm" variant="outline" disabled={rows.length === 0}
                    onClick={() =>
                      downloadCsv(`${t}-interactions.csv`, csv(
                        rows.map((r) => ({
                          created_at: r.created_at,
                          session_id: r.session_id,
                          layer: layerLabel[r.layer_id || ""]?.label || "",
                          layer_type: layerLabel[r.layer_id || ""]?.type || "",
                        })),
                        ["created_at", "session_id", "layer", "layer_type"]
                      ))
                    }
                  >
                    <Download className="mr-1 h-3 w-3" /> CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No {label.toLowerCase()} tracked yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {rows.slice(0, 200).map((r) => {
                        const lab = layerLabel[r.layer_id || ""];
                        return (
                          <div key={r.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {lab?.label || "(unknown layer)"}
                                {lab?.type && <Badge variant="secondary" className="ml-2">{lab.type}</Badge>}
                              </div>
                              <div className="text-muted-foreground">
                                {new Date(r.created_at).toLocaleString()} · session {(r.session_id || "").slice(0, 8) || "—"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!openOrder} onOpenChange={(o) => !o && setOpenOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
          </DialogHeader>
          {openOrder && (() => {
            const d = openOrder.data || {};
            const c = d.customer || {};
            const items = d.items || [];
            const meta = statusMeta(openOrder.status);
            return (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <Badge className={meta.cls}>{meta.label}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(openOrder.created_at).toLocaleString()}</span>
                </div>
                <div className="rounded border border-border p-2 text-xs space-y-0.5">
                  <div><span className="text-muted-foreground">Name:</span> {c.name || "—"}</div>
                  <div><span className="text-muted-foreground">Email:</span> {c.email || "—"}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {c.phone || "—"}</div>
                  <div><span className="text-muted-foreground">Address:</span> {c.address || "—"}</div>
                  {d.notes && <div><span className="text-muted-foreground">Notes:</span> {d.notes}</div>}
                </div>
                <div className="rounded border border-border">
                  <div className="border-b border-border px-2 py-1 text-xs font-medium text-muted-foreground">Items</div>
                  {items.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">No items.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {items.map((it: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{it.name || it.title || `Item ${i + 1}`}</div>
                            {it.qty != null && <div className="text-muted-foreground">Qty: {it.qty}</div>}
                          </div>
                          <div className="font-mono">{d.currency || ""} {it.price ?? ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border px-2 py-1 text-xs">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{d.currency || ""} {d.total ?? ""}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="flex-wrap gap-2 sm:justify-start">
            {ORDER_STATUSES.map((s) => {
              const active = (openOrder?.status || "new") === s.value;
              return (
                <Button
                  key={s.value}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={active ? s.cls : ""}
                  onClick={() => openOrder && setOrderStatus(openOrder.id, s.value)}
                >
                  {s.label}
                </Button>
              );
            })}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
