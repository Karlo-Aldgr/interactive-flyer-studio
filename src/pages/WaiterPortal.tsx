import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

type Order = {
  id: string; customer_name: string; items: any[]; status: string;
  table_number: string | null; notes: string | null; order_type: string;
  pickup_at: string | null; created_at: string; subtotal_cents?: number;
};

export default function WaiterPortal() {
  const { token } = useParams(); // portal_token from flyer_portal_credentials
  const [flyerId, setFlyerId] = useState<string | null>(null);
  const [flyerTitle, setFlyerTitle] = useState("");
  const [resolving, setResolving] = useState(true);

  const [pin, setPin] = useState("");
  const [pinSaved, setPinSaved] = useState<string | null>(null);
  const [waiter, setWaiter] = useState<{ id: string; name: string; color: string } | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  // Resolve token → flyer
  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data } = await supabase.from("flyer_portal_credentials").select("flyer_id").eq("portal_token", token).maybeSingle();
      if (!data) { setResolving(false); return; }
      setFlyerId(data.flyer_id);
      const { data: f } = await supabase.from("flyers").select("title").eq("id", data.flyer_id).maybeSingle();
      setFlyerTitle(f?.title || "Flyer");
      setResolving(false);
      // restore PIN session
      const stored = sessionStorage.getItem(`waiter_pin_${data.flyer_id}`);
      if (stored) setPinSaved(stored);
    })();
  }, [token]);

  const fetchOrders = useCallback(async (usePin: string) => {
    if (!flyerId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("waiter-orders", {
      body: { action: "list", flyer_id: flyerId, pin: usePin },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      sessionStorage.removeItem(`waiter_pin_${flyerId}`);
      setPinSaved(null); setWaiter(null);
      return toast.error((data as any)?.error || "PIN invalid");
    }
    setWaiter((data as any).waiter);
    setTables((data as any).tables || []);
    setOrders((data as any).orders || []);
  }, [flyerId]);

  useEffect(() => {
    if (pinSaved && flyerId) fetchOrders(pinSaved);
  }, [pinSaved, flyerId, fetchOrders]);

  // Realtime: any change to menu_orders for this flyer → re-fetch (server filters by waiter)
  useEffect(() => {
    if (!waiter || !flyerId || !pinSaved) return;
    const ch = supabase.channel(`waiter-${flyerId}-${waiter.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_orders", filter: `flyer_id=eq.${flyerId}` }, () => fetchOrders(pinSaved))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [waiter, flyerId, pinSaved, fetchOrders]);

  async function login() {
    if (!flyerId || pin.length < 4) return toast.error("Enter your PIN");
    const { data, error } = await supabase.functions.invoke("waiter-master-auth", {
      body: { action: "waiter_verify", flyer_id: flyerId, pin },
    });
    if (error || !(data as any)?.ok) return toast.error("PIN not recognized");
    sessionStorage.setItem(`waiter_pin_${flyerId}`, pin);
    setPinSaved(pin);
    setPin("");
  }
  function logout() {
    if (flyerId) sessionStorage.removeItem(`waiter_pin_${flyerId}`);
    setPinSaved(null); setWaiter(null); setOrders([]); setTables([]);
  }

  async function setStatus(orderId: string, status: string) {
    if (!flyerId || !pinSaved) return;
    const { data, error } = await supabase.functions.invoke("waiter-orders", {
      body: { action: "update_status", flyer_id: flyerId, pin: pinSaved, order_id: orderId, status },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || "Failed");
    fetchOrders(pinSaved);
  }

  if (resolving) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!flyerId) return <div className="p-8 text-destructive">Invalid waiter portal link.</div>;

  if (!waiter) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle className="text-base">{flyerTitle} — Waiter Login</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Enter your PIN to view your tables' orders.</p>
            <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" onKeyDown={(e) => e.key === "Enter" && login()} />
            <Button onClick={login} className="w-full">Sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: waiter.color }} />
          <h1 className="text-lg font-semibold">{waiter.name}</h1>
          <span className="text-xs text-muted-foreground">— {flyerTitle}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={logout}><LogOut className="h-4 w-4 mr-1" />Logout</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Your tables:</span>
        {tables.length === 0 ? <Badge variant="outline">none assigned</Badge> : tables.map((t) => <Badge key={t} variant="secondary">Table {t}</Badge>)}
        <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => {
          const billable = orders.filter(o => o.status !== "cancelled" && o.status !== "pending_approval");
          const total = billable.reduce((s, o) => {
            if (typeof o.subtotal_cents === "number") return s + o.subtotal_cents / 100;
            return s + (o.items || []).reduce((a: number, it: any) => a + (it.price || 0) * (it.qty || 0), 0);
          }, 0);
          toast.success(`Tonight: ${billable.length} orders · $${total.toFixed(2)}`, { duration: 6000 });
        }}>Total tonight</Button>
      </div>

      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active orders for your tables.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className={o.order_type === "order_ahead" ? "border-red-300" : ""}>
              <CardContent className="p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Table {o.table_number} · {o.customer_name}</div>
                  <Badge variant={o.status === "pending_approval" ? "destructive" : "secondary"}>{o.status}</Badge>
                </div>
                <ul className="my-1 text-xs">
                  {(o.items || []).map((it: any, i: number) => <li key={i}>{it.qty}× {it.name}</li>)}
                </ul>
                {o.notes && <div className="italic text-xs text-muted-foreground">"{o.notes}"</div>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {["new", "preparing", "served", "completed"].map((s) => (
                    <Button key={s} size="sm" variant={o.status === s ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setStatus(o.id, s)}>{s}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
