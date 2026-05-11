import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Download, Eye, Users, CalendarDays, FileText, BarChart3, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface PortalFeatures {
  actionTypes: string[];
  hasHotspots: boolean;
  hasAppointments: boolean;
  hasSubscribe: boolean;
  hasForms: boolean;
  hasPolls: boolean;
  hasCheckout: boolean;
  hasCalls: boolean;
}
interface CartEmail { created_at: string; name: string | null; email: string; phone: string | null; address: string | null; total: number | null; currency: string | null; items: number }
interface LayerClick { layer_id: string; label: string; type: string; action_type: string | null; clicks: number }
interface PortalData {
  flyer: { id: string; title: string; status: string; public_slug: string | null; thumbnail_url: string | null; created_at: string };
  counts: { views: number; uniqueVisitors?: number; returnVisitors?: number; clicks?: number; subscribers: number; appointments: number; submissions: number; pollVotes: number; purchases: number; cartOrders?: number; cartRevenue?: number };
  analytics?: { dailyViews: { date: string; count: number }[]; topLayerClicks: LayerClick[]; actionTypeClicks: Record<string, number> };
  cartEmails?: CartEmail[];
  subscribers: any[];
  appointments: any[];
  submissions: any[];
  pollVotes: any[];
  events: any[];
  features?: PortalFeatures;
  actions?: Array<{ id: string; type: string; layer_id: string }>;
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
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function PublicFlyerPortal() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unlock(c: string) {
    if (!token || !c.trim()) return;
    setLoading(true); setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("portal-access", {
      body: { token, code: c.trim() },
    });
    setLoading(false);
    if (err || (res as any)?.error) {
      const msg = (res as any)?.error || err?.message || "Could not load portal";
      setError(msg);
      return;
    }
    setData(res as PortalData);
  }

  // Auto-unlock when ?code= present
  useEffect(() => {
    const c = params.get("code");
    if (c && !data) void unlock(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Flyer portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the access code for this flyer's portal.</p>
            <div className="space-y-1">
              <Label htmlFor="code">Access code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && unlock(code)}
                placeholder="ABC123"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={() => unlock(code)} disabled={loading || !code.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const f: PortalFeatures = data.features ?? {
    actionTypes: [], hasHotspots: false, hasAppointments: true,
    hasSubscribe: true, hasForms: true, hasPolls: true, hasCheckout: false, hasCalls: false,
  };

  const allStats = [
    { key: "views", label: "Views", value: data.counts.views, Icon: Eye, show: true },
    { key: "uniq", label: "Unique visitors", value: data.counts.uniqueVisitors ?? 0, Icon: Users, show: true },
    { key: "ret", label: "Return visitors", value: data.counts.returnVisitors ?? 0, Icon: Users, show: true },
    { key: "clicks", label: "Total clicks", value: data.counts.clicks ?? 0, Icon: BarChart3, show: true },
    { key: "subs", label: "Subscribers", value: data.counts.subscribers, Icon: Users, show: f.hasSubscribe },
    { key: "appts", label: "Appointments", value: data.counts.appointments, Icon: CalendarDays, show: f.hasAppointments },
    { key: "forms", label: "Form submissions", value: data.counts.submissions, Icon: FileText, show: f.hasForms },
    { key: "polls", label: "Poll votes", value: data.counts.pollVotes, Icon: BarChart3, show: f.hasPolls },
    { key: "cart", label: "Cart orders", value: data.counts.cartOrders ?? 0, Icon: ShoppingCart, show: f.hasCheckout || (data.counts.cartOrders ?? 0) > 0 },
  ];
  const stats = allStats.filter((s) => s.show);

  // Aggregate poll votes by option
  const pollAgg: Record<string, number> = {};
  for (const v of data.pollVotes) pollAgg[v.option_id] = (pollAgg[v.option_id] || 0) + 1;

  const cartEmails = data.cartEmails || [];
  const topClicks = data.analytics?.topLayerClicks || [];
  const dailyViews = data.analytics?.dailyViews || [];
  const maxDaily = dailyViews.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  const tabDefs = [
    { value: "analytics", label: "Analytics", show: true },
    { value: "appointments", label: "Appointments", show: f.hasAppointments },
    { value: "subscribers", label: "Subscribers", show: f.hasSubscribe },
    { value: "cart", label: "Cart emails", show: f.hasCheckout || cartEmails.length > 0 },
    { value: "forms", label: "Form submissions", show: f.hasForms },
    { value: "polls", label: "Polls", show: f.hasPolls },
    { value: "events", label: "Recent activity", show: true },
  ].filter((t) => t.show);
  const defaultTab = tabDefs[0]?.value || "events";

  return (
    <div className="container mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.flyer.title}</h1>
          <p className="text-xs text-muted-foreground">
            Portal · {data.flyer.status} · created {new Date(data.flyer.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="secondary">Private</Badge>
      </div>

      {f.actionTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {f.actionTypes.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">{t.replace(/_/g, " ")}</Badge>
          ))}
          {f.hasHotspots && <Badge variant="outline" className="text-xs">hotspots</Badge>}
        </div>
      )}

      <div className={`grid grid-cols-2 gap-3 md:grid-cols-${Math.min(stats.length, 6)}`}>
        {stats.map(({ key, label, value, Icon }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex-wrap">
          {tabDefs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="analytics" className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily views (last 30 days)</CardTitle></CardHeader>
            <CardContent>
              {dailyViews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No views yet.</p>
              ) : (
                <div className="flex h-32 items-end gap-1">
                  {dailyViews.map((d) => (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                      <div className="w-full rounded-t bg-primary" style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: 2 }} />
                      <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Hotspots & clicks ({topClicks.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCsv("hotspot-clicks.csv",
                csv(topClicks, ["label", "type", "action_type", "clicks", "layer_id"]))}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {topClicks.length === 0 ? <p className="text-sm text-muted-foreground">No clicks yet.</p> :
                topClicks.map((c) => (
                  <div key={c.layer_id + (c.action_type || "")} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.label}</div>
                      <div className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-1 text-[10px]">{c.type}</Badge>
                        {c.action_type && <Badge variant="secondary" className="text-[10px]">{c.action_type.replace(/_/g, " ")}</Badge>}
                      </div>
                    </div>
                    <Badge>{c.clicks}</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {(f.hasCheckout || cartEmails.length > 0) && (
        <TabsContent value="cart">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">
                Cart emails ({cartEmails.length})
                {data.counts.cartRevenue ? <span className="ml-2 text-xs text-muted-foreground">· {data.counts.cartRevenue.toFixed(2)} revenue</span> : null}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCsv("cart-emails.csv",
                csv(cartEmails, ["created_at", "name", "email", "phone", "address", "items", "total", "currency"]))}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {cartEmails.length === 0 ? <p className="text-sm text-muted-foreground">No cart orders yet.</p> :
                cartEmails.map((c, i) => (
                  <div key={i} className="rounded border border-border p-2 text-sm">
                    <div className="font-medium">{c.name || "—"} · {c.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString()} · {c.items} item{c.items === 1 ? "" : "s"}
                      {c.total != null && <> · {c.total} {c.currency || ""}</>}
                      {c.phone && <> · {c.phone}</>}
                    </div>
                    {c.address && <div className="text-xs italic text-muted-foreground">{c.address}</div>}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {f.hasAppointments && (
        <TabsContent value="appointments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Appointments ({data.appointments.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCsv("appointments.csv",
                csv(data.appointments, ["start_at", "end_at", "name", "email", "phone", "note", "status", "timezone"]))}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.appointments.length === 0 ? <p className="text-sm text-muted-foreground">No appointments.</p> :
                data.appointments.map((a) => (
                  <div key={a.id} className="rounded border border-border p-2 text-sm">
                    <div className="font-medium">{new Date(a.start_at).toLocaleString()} {a.status === "cancelled" && <Badge variant="destructive" className="ml-1">Cancelled</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{a.name || "—"} · {a.email}{a.phone ? ` · ${a.phone}` : ""}</div>
                    {a.note && <div className="text-xs italic text-muted-foreground">"{a.note}"</div>}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {f.hasSubscribe && (
        <TabsContent value="subscribers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Subscribers ({data.subscribers.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCsv("subscribers.csv",
                csv(data.subscribers, ["created_at", "name", "email", "phone", "list_name"]))}>
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.subscribers.length === 0 ? <p className="text-sm text-muted-foreground">No subscribers yet.</p> :
                data.subscribers.map((s) => (
                  <div key={s.id} className="text-sm">
                    <span className="font-medium">{s.name || "—"}</span> · {s.email}{s.phone ? ` · ${s.phone}` : ""}
                    {s.list_name && <Badge variant="secondary" className="ml-2">{s.list_name}</Badge>}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {f.hasForms && (
        <TabsContent value="forms">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Form submissions ({data.submissions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.submissions.length === 0 ? <p className="text-sm text-muted-foreground">No submissions yet.</p> :
                data.submissions.map((s) => (
                  <div key={s.id} className="rounded border border-border p-2 text-xs">
                    <div className="font-mono text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                    <pre className="mt-1 whitespace-pre-wrap break-words">{JSON.stringify(s.data, null, 2)}</pre>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {f.hasPolls && (
        <TabsContent value="polls">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Poll results ({data.pollVotes.length} votes)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(pollAgg).length === 0 ? <p className="text-sm text-muted-foreground">No votes yet.</p> :
                Object.entries(pollAgg).sort((a, b) => b[1] - a[1]).map(([opt, n]) => (
                  <div key={opt} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                    <span className="font-mono text-xs">{opt}</span>
                    <Badge>{n}</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        <TabsContent value="events">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent activity ({data.events.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1 max-h-[600px] overflow-auto">
              {data.events.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> :
                data.events.slice(0, 200).map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span><Badge variant="outline" className="mr-2">{e.event_type}</Badge></span>
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
