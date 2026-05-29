import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lock, Check, X, RefreshCw } from "lucide-react";

type Order = {
  id: string; flyer_id: string; customer_name: string; customer_phone: string | null;
  items: any[]; subtotal_cents: number; notes: string | null; status: string;
  table_number: string | null; order_type: string; pickup_at: string | null;
  created_at: string; archived_at: string | null;
};

export function LiveOrdersBoard({ flyerId }: { flyerId: string }) {
  const SESSION_KEY = `master_unlocked_${flyerId}`;
  const [unlocked, setUnlocked] = useState<boolean>(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableWaiters, setTableWaiters] = useState<Record<string, { name: string; color: string }>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke("waiter-master-auth", {
        body: { action: "master_status", flyer_id: flyerId },
      });
      setPinSet(!!(data as any)?.set);
    })();
  }, [flyerId]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("menu_orders").select("*")
      .eq("flyer_id", flyerId).is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setOrders((data as Order[]) || []);
    setLoading(false);
  }, [flyerId]);

  const loadAssignments = useCallback(async () => {
    const { data: assigns } = await supabase.from("table_assignments")
      .select("table_number, waiter_id").eq("flyer_id", flyerId);
    const { data: ws } = await supabase.from("waiters_public" as any)
      .select("id, name, color").eq("flyer_id", flyerId);
    const wmap = new Map<string, { name: string; color: string }>();
    for (const w of (ws as any[]) || []) wmap.set(w.id, { name: w.name, color: w.color });
    const map: Record<string, { name: string; color: string }> = {};
    for (const a of (assigns as any[]) || []) {
      const w = wmap.get(a.waiter_id);
      if (w) map[a.table_number] = w;
    }
    setTableWaiters(map);
  }, [flyerId]);

  useEffect(() => {
    if (!unlocked) return;
    load();
    loadAssignments();
    const channel = supabase.channel(`live-orders-${flyerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_orders", filter: `flyer_id=eq.${flyerId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "table_assignments", filter: `flyer_id=eq.${flyerId}` }, () => loadAssignments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unlocked, flyerId, load, loadAssignments]);

  async function handleUnlock() {
    if (pinSet === false) {
      // first-time setup
      if (pin.length < 4) return toast.error("Choose 4+ digit PIN");
      const { data, error } = await supabase.functions.invoke("waiter-master-auth", {
        body: { action: "master_set", flyer_id: flyerId, new_pin: pin },
      });
      if (error || (data as any)?.error) return toast.error((data as any)?.error || "Failed");
      toast.success("Master PIN set");
      setPinSet(true);
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
      setPin("");
      return;
    }
    const { data } = await supabase.functions.invoke("waiter-master-auth", {
      body: { action: "master_verify", flyer_id: flyerId, pin },
    });
    if ((data as any)?.ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
      setPin("");
    } else toast.error("Wrong PIN");
  }

  async function approve(orderId: string, decision: "approve" | "reject") {
    const { data, error } = await supabase.functions.invoke("approve-order", { body: { order_id: orderId, decision } });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || "Failed");
    toast.success(decision === "approve" ? "Approved" : "Rejected");
    load();
  }

  async function setStatus(orderId: string, status: string) {
    const { error } = await supabase.from("menu_orders").update({ status }).eq("id", orderId);
    if (error) return toast.error(error.message);
    load();
  }

  const grouped = useMemo(() => {
    const m: Record<string, Order[]> = {};
    for (const o of orders) {
      const k = o.table_number || "(no table)";
      (m[k] ||= []).push(o);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [orders]);

  if (!unlocked) {
    return (
      <Card className="max-w-md">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Master Order Portal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {pinSet === null ? <p className="text-sm text-muted-foreground">Loading…</p> : pinSet === false ? (
            <p className="text-sm">No master PIN set. Choose one now to protect the live orders view.</p>
          ) : (
            <p className="text-sm">Enter master PIN to view live orders across all tables.</p>
          )}
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" onKeyDown={(e) => e.key === "Enter" && handleUnlock()} />
          <Button onClick={handleUnlock} className="w-full">{pinSet === false ? "Set PIN & unlock" : "Unlock"}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Master view</Badge>
          <span className="text-xs text-muted-foreground">{orders.length} active orders · live</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
          <Button size="sm" variant="outline" onClick={() => { sessionStorage.removeItem(SESSION_KEY); setUnlocked(false); }}>Lock</Button>
        </div>
      </div>

      <MasterAnalytics flyerId={flyerId} orders={orders} />

      {grouped.length === 0 && <p className="text-sm text-muted-foreground">No active orders.</p>}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {grouped.map(([table, list]) => (
          <Card key={table}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Table {table} · {list.length}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {list.map((o) => {
                const isAhead = o.order_type === "order_ahead";
                const pending = o.status === "pending_approval";
                return (
                  <div key={o.id}
                    className={`rounded border p-2 text-xs ${pending ? "border-red-500 bg-red-500/10" : isAhead ? "border-red-300" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{o.customer_name}</div>
                      <Badge variant={pending ? "destructive" : "secondary"} className="text-[10px]">{o.status}</Badge>
                    </div>
                    {isAhead && (
                      <div className="text-[11px] text-red-600 font-medium">
                        ORDER AHEAD · pickup {o.pickup_at ? new Date(o.pickup_at).toLocaleString() : "?"}
                      </div>
                    )}
                    <ul className="my-1 space-y-0.5">
                      {(o.items || []).map((it: any, i: number) => (
                        <li key={i}>{it.qty}× {it.name} <span className="text-muted-foreground">(${(it.price * it.qty).toFixed(2)})</span></li>
                      ))}
                    </ul>
                    {o.notes && <div className="italic text-muted-foreground">"{o.notes}"</div>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pending && (
                        <>
                          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => approve(o.id, "approve")}><Check className="h-3 w-3 mr-1" />Approve</Button>
                          <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px]" onClick={() => approve(o.id, "reject")}><X className="h-3 w-3 mr-1" />Reject</Button>
                        </>
                      )}
                      {!pending && ["new", "preparing", "served", "completed"].map((s) => (
                        <Button key={s} size="sm" variant={o.status === s ? "default" : "outline"} className="h-6 px-2 text-[10px]" onClick={() => setStatus(o.id, s)}>{s}</Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MasterAnalytics({ flyerId, orders }: { flyerId: string; orders: Order[] }) {
  const [traffic, setTraffic] = useState<{ views: number; clicks: number; sessions: number } | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("analytics_events")
        .select("event_type, session_id")
        .eq("flyer_id", flyerId)
        .gte("created_at", since.toISOString())
        .limit(5000);
      const rows = (data || []) as { event_type: string; session_id: string | null }[];
      const views = rows.filter(r => r.event_type === "view").length;
      const clicks = rows.filter(r => r.event_type === "click").length;
      const sessions = new Set(rows.map(r => r.session_id).filter(Boolean)).size;
      setTraffic({ views, clicks, sessions });
    })();
  }, [flyerId, orders.length]);

  const sales = useMemo(() => {
    const billable = orders.filter(o => o.status !== "cancelled" && o.status !== "pending_approval");
    const totalCents = billable.reduce((s, o) => s + (o.subtotal_cents || 0), 0);
    const counts = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of billable) for (const it of (o.items || []) as any[]) {
      const key = it.id || it.name;
      const prev = counts.get(key) || { name: it.name, qty: 0, revenue: 0 };
      prev.qty += it.qty || 0;
      prev.revenue += (it.price || 0) * (it.qty || 0);
      counts.set(key, prev);
    }
    const top = [...counts.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    return { totalCents, orderCount: billable.length, top };
  }, [orders]);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Today at a glance</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
        <Stat label="Sales" value={`$${(sales.totalCents / 100).toFixed(2)}`} />
        <Stat label="Orders" value={String(sales.orderCount)} />
        <Stat label="Visitors" value={traffic ? String(traffic.sessions) : "…"} sub={traffic ? `${traffic.views} views · ${traffic.clicks} clicks` : ""} />
        <div>
          <div className="text-[11px] uppercase text-muted-foreground">Most ordered</div>
          {sales.top.length === 0 ? (
            <div className="text-xs text-muted-foreground mt-1">No sales yet</div>
          ) : (
            <ol className="mt-1 space-y-0.5 text-xs">
              {sales.top.map((t, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {t.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap">×{t.qty}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
