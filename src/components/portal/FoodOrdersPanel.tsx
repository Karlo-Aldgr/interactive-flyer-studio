import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  FOOD_ORDER_STATUSES,
  foodStatusMeta,
  menuStatusToFoodStatus,
  paymentBadgeCls,
  paymentMethodLabel,
  paymentStatusLabel,
  type FoodOrderStatus,
} from "@/lib/menuOrderStatus";
import { markMenuOrderPaid, updateMenuOrderFoodStatus, type MenuOrderRow } from "@/lib/menuOrderSync";
import { menuStatusToCustomerPhase, MENU_CUSTOMER_PHASES } from "@/lib/customerOrderStatus";

type Props = {
  flyerId: string;
  userEmail?: string | null;
  onLogPortalEvent?: (actionType: string, extra?: Record<string, unknown>) => void;
};

export function FoodOrdersPanel({ flyerId, userEmail, onLogPortalEvent }: Props) {
  const [orders, setOrders] = useState<MenuOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openOrder, setOpenOrder] = useState<MenuOrderRow | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<MenuOrderRow | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [payLaterAlertOpen, setPayLaterAlertOpen] = useState(false);
  const [payLaterAlertShown, setPayLaterAlertShown] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_orders")
      .select("*")
      .eq("flyer_id", flyerId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else {
      const rows = ((data as MenuOrderRow[]) || []).filter(
        (o) => !["cancelled", "rejected"].includes((o.status || "").toLowerCase()),
      );
      setOrders(rows);
    }
    setLoading(false);
  }, [flyerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const foodCounts = useMemo(() => {
    const c: Record<FoodOrderStatus, number> = {
      pending: 0, in_production: 0, on_hold: 0, served: 0, completed: 0,
    };
    for (const o of orders) {
      const f = menuStatusToFoodStatus(o.status);
      c[f] += 1;
    }
    return c;
  }, [orders]);

  const unpaidCount = useMemo(
    () => orders.filter((o) => paymentStatusLabel(o.payment_status) === "Unpaid").length,
    [orders],
  );

  useEffect(() => {
    if (payLaterAlertShown || unpaidCount === 0) return;
    setPayLaterAlertOpen(true);
    setPayLaterAlertShown(true);
  }, [unpaidCount, payLaterAlertShown]);

  async function setFoodStatus(orderId: string, food: FoodOrderStatus) {
    const { error } = await updateMenuOrderFoodStatus(orderId, food);
    if (error) return toast.error(error);
    toast.success("Food status updated");
    load();
    if (openOrder?.id === orderId) {
      setOpenOrder((o) => (o ? { ...o, status: food === "pending" ? "new" : food === "in_production" ? "preparing" : food } : o));
    }
  }

  async function confirmMarkPaid() {
    if (!confirmPaid) return;
    setMarkingPaid(true);
    const { error } = await markMenuOrderPaid(confirmPaid.id, userEmail || "owner");
    setMarkingPaid(false);
    if (error) return toast.error(error);
    onLogPortalEvent?.("pay_later_paid", { order_id: confirmPaid.id, paid_by: userEmail });
    toast.success("Marked as paid");
    setConfirmPaid(null);
    setOpenOrder(null);
    load();
  }

  const currency = "$";

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Food orders</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            {FOOD_ORDER_STATUSES.map((s) => (
              <Badge key={s.value} className={s.cls} variant="default">
                {s.label}: {foodCounts[s.value]}
              </Badge>
            ))}
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No food orders yet.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => {
                const food = menuStatusToFoodStatus(o.status);
                const meta = foodStatusMeta(food);
                const total = (o.subtotal_cents || 0) / 100;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setOpenOrder(o);
                      if (paymentStatusLabel(o.payment_status) === "Unpaid") {
                        onLogPortalEvent?.("pay_later_view", { order_id: o.id });
                      }
                    }}
                    className={`w-full rounded border-l-4 ${meta.ring} border border-border p-2 text-left text-xs transition hover:bg-muted/50`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">Table {o.table_number || "—"}</Badge>
                          <Badge className={`text-[10px] ${paymentBadgeCls(o.payment_status)}`}>
                            {paymentStatusLabel(o.payment_status)}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {paymentMethodLabel(o.payment_method)}
                          </Badge>
                        </div>
                        <div className="mt-1 font-medium truncate">{o.customer_name}</div>
                        <div className="text-muted-foreground">
                          {new Date(o.created_at).toLocaleString()} · {(o.items || []).length} items · {currency}{total.toFixed(2)}
                        </div>
                        {paymentStatusLabel(o.payment_status) === "Unpaid" && (
                          <div className="mt-1 font-semibold text-red-600">⚠ Payment pending</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={meta.cls}>{meta.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Customer: {MENU_CUSTOMER_PHASES.find((p) => p.id === menuStatusToCustomerPhase(o.status))?.label || "Pending"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openOrder} onOpenChange={(v) => !v && setOpenOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Food order details</DialogTitle></DialogHeader>
          {openOrder && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={foodStatusMeta(menuStatusToFoodStatus(openOrder.status)).cls}>
                  {foodStatusMeta(menuStatusToFoodStatus(openOrder.status)).label}
                </Badge>
                <Badge className={paymentBadgeCls(openOrder.payment_status)}>
                  {paymentStatusLabel(openOrder.payment_status)}
                </Badge>
                <Badge variant="outline">{paymentMethodLabel(openOrder.payment_method)}</Badge>
              </div>
              {paymentStatusLabel(openOrder.payment_status) === "Unpaid" && (
                <div className="rounded border-2 border-red-600 bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
                  <div className="font-semibold text-red-700">Collect payment from customer</div>
                  <p className="text-xs text-red-700/80">
                    Total due: {currency}{((openOrder.subtotal_cents || 0) / 100).toFixed(2)}
                  </p>
                  {openOrder.customer_phone && (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                        <a href={`tel:${openOrder.customer_phone}`}>Call</a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`sms:${openOrder.customer_phone}`}>Text</a>
                      </Button>
                    </div>
                  )}
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setConfirmPaid(openOrder)}>
                    Mark as paid…
                  </Button>
                </div>
              )}
              <div className="rounded border border-border p-2 text-xs space-y-0.5">
                <div><span className="text-muted-foreground">Name:</span> {openOrder.customer_name}</div>
                <div><span className="text-muted-foreground">Phone:</span> {openOrder.customer_phone || "—"}</div>
                <div><span className="text-muted-foreground">Table:</span> {openOrder.table_number || "—"}</div>
                {openOrder.notes && <div><span className="text-muted-foreground">Notes:</span> {openOrder.notes}</div>}
              </div>
              <div className="rounded border border-border divide-y divide-border">
                {(openOrder.items as any[]).map((it, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 text-xs">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{it.qty}× {it.name}</span>
                    <span>{currency}{((it.price || 0) * (it.qty || 1)).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between p-2 text-xs font-semibold">
                  <span>Total</span>
                  <span>{currency}{((openOrder.subtotal_cents || 0) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2 sm:justify-start">
            {FOOD_ORDER_STATUSES.map((s) => {
              const active = openOrder && menuStatusToFoodStatus(openOrder.status) === s.value;
              return (
                <Button
                  key={s.value}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={active ? s.cls : ""}
                  onClick={() => openOrder && setFoodStatus(openOrder.id, s.value)}
                >
                  {s.label}
                </Button>
              );
            })}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmPaid} onOpenChange={(v) => !v && !markingPaid && setConfirmPaid(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Confirm payment received
            </DialogTitle>
            <DialogDescription>Only mark paid after you have actually received the funds.</DialogDescription>
          </DialogHeader>
          {confirmPaid && (
            <div className="rounded border-2 border-red-600 bg-red-50 p-3 text-sm">
              <div>Customer: {confirmPaid.customer_name}</div>
              <div>Amount: <strong>{currency}{((confirmPaid.subtotal_cents || 0) / 100).toFixed(2)}</strong></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmPaid(null)} disabled={markingPaid}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmMarkPaid} disabled={markingPaid}>
              {markingPaid ? "Saving…" : "Yes, payment received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payLaterAlertOpen} onOpenChange={setPayLaterAlertOpen}>
        <DialogContent className="max-w-md border-2 border-red-600">
          <DialogHeader>
            <DialogTitle className="text-red-600">Unpaid orders need attention</DialogTitle>
            <DialogDescription>
              {unpaidCount} order(s) are still unpaid. Collect payment before closing out the table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => setPayLaterAlertOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
