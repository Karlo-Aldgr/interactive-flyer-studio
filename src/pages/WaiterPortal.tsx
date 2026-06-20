import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { waiterPortalList, waiterPortalLogin, waiterPortalUpdateStatus, waiterPortalMarkPaid, resolveWaiterPortalToken } from "@/lib/waiterPortalApi";
import { paymentBadgeCls, paymentStatusLabel } from "@/lib/menuOrderStatus";

type Order = {
  id: string; customer_name: string; items: any[]; status: string;
  payment_status?: string; payment_method?: string | null;
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

  // Resolve token → flyer (anon-safe via RPC)
  useEffect(() => {
    (async () => {
      if (!token) { setResolving(false); return; }
      try {
        const { flyerId: fid, title } = await resolveWaiterPortalToken(token);
        setFlyerId(fid);
        setFlyerTitle(title);
        const stored = sessionStorage.getItem(`waiter_pin_${fid}`);
        if (stored) setPinSaved(stored);
      } catch (e: any) {
        if (e?.message === "RUN_RPC_SQL") {
          // Fallback when owner is logged in on same browser
          const { data } = await supabase
            .from("flyer_portal_credentials")
            .select("flyer_id")
            .eq("portal_token", token)
            .maybeSingle();
          if (data?.flyer_id) {
            setFlyerId(data.flyer_id);
            const { data: f } = await supabase.from("flyers").select("title").eq("id", data.flyer_id).maybeSingle();
            setFlyerTitle(f?.title || "Flyer");
            const stored = sessionStorage.getItem(`waiter_pin_${data.flyer_id}`);
            if (stored) setPinSaved(stored);
          }
        }
      } finally {
        setResolving(false);
      }
    })();
  }, [token]);

  const fetchOrders = useCallback(async (usePin: string) => {
    if (!flyerId) return;
    setLoading(true);
    try {
      const data = await waiterPortalList(flyerId, usePin);
      setWaiter(data.waiter);
      setTables(data.tables || []);
      setOrders(data.orders || []);
    } catch (e: any) {
      sessionStorage.removeItem(`waiter_pin_${flyerId}`);
      setPinSaved(null);
      setWaiter(null);
      const msg = e?.message || "PIN invalid";
      if (msg.includes("Could not find the function")) {
        toast.error("Waiter login needs waiter_portal_rpc — run scripts/waiter-portal-rpc.sql in Supabase");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [flyerId]);

  useEffect(() => {
    if (pinSaved && flyerId) fetchOrders(pinSaved);
  }, [pinSaved, flyerId, fetchOrders]);

  // Poll for new orders instead of Realtime to avoid broadcasting customer PII
  useEffect(() => {
    if (!waiter || !flyerId || !pinSaved) return;
    const iv = setInterval(() => fetchOrders(pinSaved), 5000);
    return () => clearInterval(iv);
  }, [waiter, flyerId, pinSaved, fetchOrders]);

  async function login() {
    if (!flyerId || pin.length < 4) return toast.error("Enter your PIN");
    try {
      await waiterPortalLogin(flyerId, pin);
      sessionStorage.setItem(`waiter_pin_${flyerId}`, pin);
      setPinSaved(pin);
      setPin("");
    } catch (e: any) {
      const msg = e?.message || "PIN not recognized";
      if (msg.includes("Could not find the function")) {
        toast.error("Run scripts/waiter-portal-rpc.sql in Supabase SQL editor first");
      } else {
        toast.error(msg);
      }
    }
  }
  function logout() {
    if (flyerId) sessionStorage.removeItem(`waiter_pin_${flyerId}`);
    setPinSaved(null); setWaiter(null); setOrders([]); setTables([]);
  }

  async function setStatus(orderId: string, status: string) {
    if (!flyerId || !pinSaved) return;
    try {
      await waiterPortalUpdateStatus(flyerId, pinSaved, orderId, status);
      fetchOrders(pinSaved);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  async function markPaid(orderId: string) {
    if (!flyerId || !pinSaved) return;
    try {
      await waiterPortalMarkPaid(flyerId, pinSaved, orderId);
      toast.success("Marked as paid");
      fetchOrders(pinSaved);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  if (resolving) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!flyerId) return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center space-y-2">
        <p className="text-destructive font-medium">Invalid waiter portal link.</p>
        <p className="text-sm text-muted-foreground">
          Re-copy the link from Portal → Staff &amp; Tables, or run the updated{" "}
          <code className="text-xs">scripts/waiter-portal-rpc.sql</code> in Supabase SQL editor.
        </p>
      </div>
    </div>
  );

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
                  <div className="flex items-center gap-1">
                    <Badge className={`text-[10px] ${paymentBadgeCls(o.payment_status)}`}>
                      {paymentStatusLabel(o.payment_status)}
                    </Badge>
                    <Badge variant={o.status === "pending_approval" ? "destructive" : "secondary"}>{o.status}</Badge>
                  </div>
                </div>
                <ul className="my-1 text-xs">
                  {(o.items || []).map((it: any, i: number) => <li key={i}>{it.qty}× {it.name}</li>)}
                </ul>
                {o.notes && <div className="italic text-xs text-muted-foreground">"{o.notes}"</div>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {["new", "preparing", "on_hold", "served", "completed"].map((s) => (
                    <Button key={s} size="sm" variant={o.status === s ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setStatus(o.id, s)}>{s}</Button>
                  ))}
                  {paymentStatusLabel(o.payment_status) === "Unpaid" && (
                    <Button size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markPaid(o.id)}>
                      Mark paid
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
