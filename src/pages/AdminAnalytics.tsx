import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, BarChart3, Eye, MousePointerClick, Users, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sourceFromEventMetadata } from "@/lib/trafficSource";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { checkIsAdmin } from "@/lib/roles";

type Ev = {
  id: string;
  event_type: string;
  session_id: string | null;
  flyer_id: string;
  created_at: string;
  metadata: any;
};

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
  { value: "all", label: "All time" },
];

export default function AdminAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Ev[]>([]);
  const [flyerTitles, setFlyerTitles] = useState<Map<string, string>>(new Map());
  const [range, setRange] = useState("30");

  useEffect(() => {
    if (!user) return;
    checkIsAdmin(user.id).then(setIsAdmin);
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("analytics_events")
        .select("id,event_type,session_id,flyer_id,created_at,metadata")
        .order("created_at", { ascending: false })
        .limit(10000);
      if (range !== "all") {
        const since = new Date(Date.now() - parseInt(range) * 86400000).toISOString();
        q = q.gte("created_at", since);
      }
      const [evRes, flyersRes] = await Promise.all([
        q,
        supabase.from("flyers").select("id,title"),
      ]);
      setEvents((evRes.data ?? []) as Ev[]);
      setFlyerTitles(new Map((flyersRes.data ?? []).map((f: any) => [f.id, f.title])));
      setLoading(false);
    })();
  }, [isAdmin, range]);

  const stats = useMemo(() => {
    const views = events.filter((e) => e.event_type === "view");
    const clicks = events.filter((e) => e.event_type === "click");
    const uniqueSessions = new Set(events.map((e) => e.session_id).filter(Boolean));
    const uniqueFlyers = new Set(events.map((e) => e.flyer_id));

    // Top flyers by views
    const flyerViews = new Map<string, number>();
    views.forEach((v) => flyerViews.set(v.flyer_id, (flyerViews.get(v.flyer_id) || 0) + 1));
    const topFlyers = [...flyerViews.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Device breakdown
    const devices = new Map<string, number>();
    events.forEach((e) => {
      const d = e.metadata?.device || "unknown";
      devices.set(d, (devices.get(d) || 0) + 1);
    });

    // Traffic source breakdown (views only)
    const sources = new Map<string, number>();
    views.forEach((e) => {
      const s = sourceFromEventMetadata(e.metadata) || "Direct";
      sources.set(s, (sources.get(s) || 0) + 1);
    });

    // Daily timeline (views per day)
    const daily = new Map<string, number>();
    views.forEach((v) => {
      const day = v.created_at.slice(0, 10);
      daily.set(day, (daily.get(day) || 0) + 1);
    });
    const timeline = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const maxDaily = timeline.reduce((m, [, n]) => Math.max(m, n), 0);

    return {
      totalViews: views.length,
      totalClicks: clicks.length,
      uniqueVisitors: uniqueSessions.size,
      activeFlyers: uniqueFlyers.size,
      topFlyers,
      devices: [...devices.entries()].sort((a, b) => b[1] - a[1]),
      sources: [...sources.entries()].sort((a, b) => b[1] - a[1]),
      timeline,
      maxDaily,
    };
  }, [events]);

  if (authLoading || isAdmin === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AdminLayout active="analytics">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Site-wide analytics</h1>
            <p className="text-sm text-muted-foreground">Views, clicks, and engagement across every flyer.</p>
          </div>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard icon={<Eye className="h-4 w-4" />} label="Total views" value={stats.totalViews} />
              <StatCard icon={<Users className="h-4 w-4" />} label="Unique visitors" value={stats.uniqueVisitors} />
              <StatCard icon={<MousePointerClick className="h-4 w-4" />} label="Total clicks" value={stats.totalClicks} />
              <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Active flyers" value={stats.activeFlyers} />
            </div>

            <Card className="p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Views over time</h2>
              {stats.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No views in this range.</p>
              ) : (
                <div className="flex h-40 items-end gap-1">
                  {stats.timeline.map(([day, count]) => (
                    <div key={day} className="group relative flex flex-1 flex-col items-center">
                      <div
                        className="w-full rounded-t bg-primary/80 transition hover:bg-primary"
                        style={{ height: `${(count / stats.maxDaily) * 100}%`, minHeight: "2px" }}
                        title={`${day}: ${count}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              {stats.timeline.length > 0 && (
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{stats.timeline[0][0]}</span>
                  <span>{stats.timeline[stats.timeline.length - 1][0]}</span>
                </div>
              )}
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="p-5">
                <h2 className="mb-4 font-display text-lg font-semibold">Top flyers</h2>
                {stats.topFlyers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topFlyers.map(([id, count]) => {
                      const title = flyerTitles.get(id) || id.slice(0, 8);
                      const max = stats.topFlyers[0][1];
                      const pct = (count / max) * 100;
                      return (
                        <div key={id}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <Link to={`/analytics/${id}`} className="truncate font-medium hover:underline">{title}</Link>
                            <span className="tabular-nums text-muted-foreground">{count}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                  <Smartphone className="h-4 w-4" /> Devices
                </h2>
                {stats.devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.devices.map(([d, n]) => {
                      const total = stats.devices.reduce((s, [, x]) => s + x, 0);
                      const pct = (n / total) * 100;
                      return (
                        <div key={d}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="capitalize">{d}</span>
                            <span className="tabular-nums text-muted-foreground">{n} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="mb-1 font-display text-lg font-semibold">Traffic sources</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Facebook, Instagram, TikTok, Direct, etc. Add <code>?utm_source=facebook</code> to shared links for exact attribution.
                </p>
                {stats.sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.sources.map(([s, n]) => {
                      const total = stats.sources.reduce((acc, [, x]) => acc + x, 0);
                      const pct = (n / total) * 100;
                      return (
                        <div key={s}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span>{s}</span>
                            <span className="tabular-nums text-muted-foreground">{n} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value.toLocaleString()}</div>
    </Card>
  );
}
