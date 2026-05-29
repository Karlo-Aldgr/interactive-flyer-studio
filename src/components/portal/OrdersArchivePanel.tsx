import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Order = {
  id: string; customer_name: string; items: any[]; subtotal_cents: number;
  status: string; table_number: string | null; order_type: string;
  created_at: string; archived_at: string | null;
};

export function OrdersArchivePanel({ flyerId }: { flyerId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(`${date}T00:00:00`).toISOString();
    const end = new Date(`${date}T23:59:59`).toISOString();
    const { data, error } = await supabase.from("menu_orders").select("*")
      .eq("flyer_id", flyerId)
      .not("archived_at", "is", null)
      .gte("created_at", start).lte("created_at", end)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setOrders((data as Order[]) || []);
    setLoading(false);
  }, [flyerId, date]);

  useEffect(() => { load(); }, [load]);

  async function recall(id: string) {
    if (!confirm("Recall this order back to the live board?")) return;
    const { error } = await supabase.from("menu_orders").update({ archived_at: null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recalled to live board");
    load();
  }

  async function archiveAllNow() {
    if (!confirm("Manually archive ALL active orders right now? (Normally happens automatically at 3 AM)")) return;
    const { error } = await supabase.from("menu_orders")
      .update({ archived_at: new Date().toISOString() })
      .eq("flyer_id", flyerId).is("archived_at", null);
    if (error) return toast.error(error.message);
    toast.success("Archived. Cart is fresh.");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        <div className="ml-auto">
          <Button variant="destructive" size="sm" onClick={archiveAllNow}>Force archive now</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">All active orders are automatically archived every day at 3 AM so the cart starts fresh. Use Recall to pull an archived order back.</p>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No archived orders on {date}.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id}><CardContent className="p-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  Table {o.table_number || "—"} · {o.customer_name}
                  <Badge variant="secondary" className="text-[10px]">{o.status}</Badge>
                  {o.order_type === "order_ahead" && <Badge variant="destructive" className="text-[10px]">order ahead</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()}</span>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => recall(o.id)}>Recall</Button>
                </div>
              </div>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {(o.items || []).map((it: any, i: number) => <li key={i}>{it.qty}× {it.name}</li>)}
              </ul>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
