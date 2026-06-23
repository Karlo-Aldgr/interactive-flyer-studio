import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_ORDER_PHASES,
  CART_CUSTOMER_PHASES,
  MENU_CUSTOMER_PHASES,
  customerPhaseIndex,
  menuStatusToCustomerPhase,
  type CustomerOrderPhase,
  type StoredOrderTrack,
  loadOrderTrack,
  saveOrderTrack,
  clearOrderTrack,
  markOrderTrackDismissed,
} from "@/lib/customerOrderStatus";
import { paymentStatusLabel } from "@/lib/menuOrderStatus";
import { cn } from "@/lib/utils";
import { Check, Loader2, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type OrderStatusResponse = {
  orderId: string;
  kind: "cart" | "menu";
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  customerPhase: CustomerOrderPhase;
  customerLabel: string;
  customerName?: string | null;
  items?: Array<{ name?: string; qty?: number }>;
  total?: number | null;
  currency?: string | null;
  tableNumber?: string | null;
  updatedAt?: string;
  error?: string;
};

type Props = {
  flyerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-filled from checkout / menu submit */
  initialTrack?: StoredOrderTrack | null;
};

export function OrderStatusTracker({ flyerId, open, onOpenChange, initialTrack }: Props) {
  const [track, setTrack] = useState<StoredOrderTrack | null>(initialTrack ?? null);
  const [lookupId, setLookupId] = useState("");
  const [lookupKind, setLookupKind] = useState<"menu" | "cart">("menu");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [data, setData] = useState<OrderStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialTrack) setTrack(initialTrack);
    else if (open) setTrack(loadOrderTrack(flyerId));
  }, [open, initialTrack, flyerId]);

  const fetchStatus = useCallback(async (t: StoredOrderTrack) => {
    setLoading(true);
    let res: OrderStatusResponse | null = null;

    const { data: edgeRes, error } = await supabase.functions.invoke("order-status", {
      body: {
        kind: t.kind,
        orderId: t.orderId,
        email: t.email,
        phone: t.phone,
      },
    });

    if (!error && edgeRes && !(edgeRes as OrderStatusResponse).error) {
      res = edgeRes as OrderStatusResponse;
    } else if (t.kind === "menu") {
      const { data: row, error: dbErr } = await supabase
        .from("menu_orders")
        .select("id, status, payment_status, payment_method, customer_name, customer_phone, items, subtotal_cents, table_number, updated_at")
        .eq("id", t.orderId)
        .maybeSingle();
      if (!dbErr && row) {
        const phase = menuStatusToCustomerPhase(row.status);
        const labels: Record<CustomerOrderPhase, string> = {
          pending: "Pending", in_production: "Preparing", served: "Served", complete: "Complete",
        };
        res = {
          orderId: row.id,
          kind: "menu",
          status: row.status,
          paymentStatus: row.payment_status,
          paymentMethod: row.payment_method,
          customerPhase: phase,
          customerLabel: labels[phase],
          customerName: row.customer_name,
          items: (row.items as Array<{ name?: string; qty?: number }>) || [],
          total: (row.subtotal_cents || 0) / 100,
          currency: "$",
          tableNumber: row.table_number,
          updatedAt: row.updated_at,
        };
      }
    }

    setLoading(false);
    if (!res) {
      setData(null);
      return;
    }
    setData(res);
    if (res.customerPhase === "complete") {
      clearOrderTrack(flyerId);
    }
  }, [flyerId]);

  useEffect(() => {
    if (!open || !track) return;
    void fetchStatus(track);
    const iv = setInterval(() => fetchStatus(track), 12000);
    return () => clearInterval(iv);
  }, [open, track, fetchStatus]);

  async function manualLookup() {
    if (!lookupId.trim()) return toast.error("Enter your order ID");
    if (lookupKind === "cart" && !lookupEmail.trim() && !lookupPhone.trim()) {
      return toast.error("Enter email or phone used at checkout");
    }
    const t: StoredOrderTrack = {
      orderId: lookupId.trim(),
      kind: lookupKind,
      email: lookupEmail.trim() || undefined,
      phone: lookupPhone.trim() || undefined,
      placedAt: new Date().toISOString(),
    };
    saveOrderTrack(flyerId, t);
    setTrack(t);
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("order-status", {
      body: { kind: t.kind, orderId: t.orderId, email: t.email, phone: t.phone },
    });
    setLoading(false);
    if (error || (res as OrderStatusResponse)?.error) {
      setData(null);
      toast.error("Order not found — check your details");
      return;
    }
    setData(res as OrderStatusResponse);
  }

  const phase = data?.customerPhase ?? "pending";
  const phaseIdx = customerPhaseIndex(phase);
  const steps = track?.kind === "menu" ? MENU_CUSTOMER_PHASES : CART_CUSTOMER_PHASES;

  const handleOpenChange = (v: boolean) => {
    if (!v && track && data?.customerPhase !== "complete") {
      // User dismissed while order is still active — suppress auto-reopen.
      markOrderTrackDismissed(flyerId);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Track your order
            </DialogTitle>
            <button
              type="button"
              onClick={() => track && fetchStatus(track)}
              disabled={loading}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label="Refresh status"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
          <DialogDescription>
            Status updates automatically as we process your request.
          </DialogDescription>
        </DialogHeader>

        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{data.customerName || "Your order"}</div>
              {data.tableNumber && (
                <div className="text-xs text-muted-foreground">Table {data.tableNumber}</div>
              )}
              {data.paymentStatus && (
                <div className={`mt-1 text-xs font-medium ${paymentStatusLabel(data.paymentStatus) === "Paid" ? "text-emerald-600" : "text-red-600"}`}>
                  Payment: {paymentStatusLabel(data.paymentStatus)}
                </div>
              )}
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">#{data.orderId.slice(0, 8)}…</div>
            </div>

            <div className="flex items-center justify-between gap-1">
              {steps.map((step, i) => {
                const done = i < phaseIdx;
                const active = i === phaseIdx;
                return (
                  <div key={step.id} className="flex flex-1 flex-col items-center gap-1 text-center">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                        done && "border-emerald-600 bg-emerald-600 text-white",
                        active && !done && "border-primary bg-primary text-primary-foreground",
                        !done && !active && "border-muted-foreground/30 bg-background text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={cn("text-[10px] leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-sm font-medium text-foreground">{data.customerLabel}</p>
            <p className="text-center text-xs text-muted-foreground">
              {steps.find((p) => p.id === phase)?.description}
            </p>

            {(data.items?.length ?? 0) > 0 && (
              <ul className="rounded border border-border p-2 text-xs space-y-0.5">
                {data.items!.map((it, i) => (
                  <li key={i}>{it.qty ?? 1}× {it.name || "Item"}</li>
                ))}
                {data.total != null && (
                  <li className="border-t border-border pt-1 font-medium">
                    Total: {data.currency || ""}{Number(data.total).toFixed(2)}
                  </li>
                )}
              </ul>
            )}

            <Button variant="outline" className="w-full" disabled={loading} onClick={() => track && fetchStatus(track)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh status
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Look up an order with the ID from your confirmation. Menu orders use phone; product cart uses email or phone.
            </p>
            <div>
              <Label className="text-xs">Order type</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={lookupKind}
                onChange={(e) => setLookupKind(e.target.value as "menu" | "cart")}
              >
                <option value="menu">Restaurant menu order</option>
                <option value="cart">Product cart order</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Order ID</Label>
              <Input className="mt-1 font-mono text-xs" value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="From confirmation" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" className="mt-1" value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Phone (optional)</Label>
              <Input className="mt-1" value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} />
            </div>
            <Button className="w-full" onClick={manualLookup}>Find order</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Floating chip — visible whenever a non-complete order is stored for this flyer.
 * Persists across refresh/close via localStorage. Validates with the server and
 * auto-clears if the order is already complete. Auto-opens the tracker once per
 * page load unless the user previously dismissed it.
 */
export function OrderTrackFloatingButton({
  flyerId,
  onOpen,
  autoOpen = true,
}: {
  flyerId: string;
  onOpen: () => void;
  autoOpen?: boolean;
}) {
  const [track, setTrack] = useState<StoredOrderTrack | null>(() => loadOrderTrack(flyerId));
  const [phase, setPhase] = useState<CustomerOrderPhase | null>(null);
  const autoOpenedRef = useState({ done: false })[0];

  // Re-read on flyer change.
  useEffect(() => {
    setTrack(loadOrderTrack(flyerId));
  }, [flyerId]);

  // Validate with server — clear if completed.
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    const check = async () => {
      const { data, error } = await supabase.functions.invoke("order-status", {
        body: { kind: track.kind, orderId: track.orderId, email: track.email, phone: track.phone },
      });
      if (cancelled) return;
      const res = data as { customerPhase?: CustomerOrderPhase; error?: string } | null;
      if (error || res?.error) return;
      if (res?.customerPhase === "complete") {
        clearOrderTrack(flyerId);
        setTrack(null);
        setPhase(null);
        return;
      }
      setPhase(res?.customerPhase ?? null);
      // Auto-open once per page load if not dismissed.
      if (autoOpen && !autoOpenedRef.done && !track.dismissedUntilReturn) {
        autoOpenedRef.done = true;
        onOpen();
      }
    };
    void check();
    const iv = setInterval(check, 20000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [flyerId, track, autoOpen, onOpen, autoOpenedRef]);

  if (!track) return null;

  const label = phase && phase !== "pending" ? "Continue order" : "Track my order";
  const summary = [
    track.tableNumber ? `Table ${track.tableNumber}` : null,
    track.itemCount ? `${track.itemCount} item${track.itemCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" • ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center rounded-full border border-primary/40 bg-card/95 px-4 py-2 text-xs font-medium shadow-elegant backdrop-blur hover:bg-card"
    >
      <span>📦 {label}</span>
      {summary && <span className="text-[10px] font-normal text-muted-foreground">{summary}</span>}
    </button>
  );
}
