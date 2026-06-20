import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Mail,
  Package,
  Phone,
  User,
} from "lucide-react";
import {
  foodStatusMeta,
  mirrorFormStatusToFoodStatus,
  paymentBadgeCls,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/menuOrderStatus";

export type FormSubmissionRow = {
  id: string;
  data: Record<string, unknown>;
  status: string | null;
  created_at: string;
};

type Props = {
  submissions: FormSubmissionRow[];
  hasFoodOrdering?: boolean;
};

function submissionKind(data: Record<string, unknown>): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
} {
  const kind = String(data.kind || "");
  const preset = String(data._preset || "");
  if (kind === "cart_order") {
    return data.source === "menu_scan"
      ? { label: "Menu order", variant: "default" }
      : { label: "Product order", variant: "default" };
  }
  if (kind === "cart_pay_later") return { label: "Pay later", variant: "destructive" };
  if (preset === "rsvp") return { label: "RSVP", variant: "secondary" };
  if (preset === "form") return { label: "Contact form", variant: "secondary" };
  return { label: "Submission", variant: "outline" };
}

function formatMoney(currency: string, amount: unknown) {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  return `${currency}${Number.isFinite(n) ? n.toFixed(2) : amount}`;
}

function SubmissionCard({ s }: { s: FormSubmissionRow }) {
  const [showRaw, setShowRaw] = useState(false);
  const d = s.data || {};
  const kind = submissionKind(d);
  const customer = (d.customer as Record<string, unknown>) || {};
  const items = (d.items as Array<Record<string, unknown>>) || [];
  const currency = String(d.currency || "$");
  const isOrder = d.kind === "cart_order";

  const extraFields = useMemo(() => {
    const skip = new Set([
      "kind", "source", "customer", "items", "currency", "total", "notes",
      "table_number", "order_type", "pickup_at", "waiter_name", "menu_order_id",
      "payment_method", "payment_status", "paid_at", "paid_by", "food_status", "_preset",
    ]);
    return Object.entries(d).filter(([k, v]) => !skip.has(k) && v != null && v !== "");
  }, [d]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 border-b border-border bg-muted/30 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={kind.variant}>{kind.label}</Badge>
              {isOrder && d.payment_status != null && (
                <Badge className={paymentBadgeCls(String(d.payment_status))}>
                  {paymentStatusLabel(String(d.payment_status))}
                </Badge>
              )}
              {isOrder && d.payment_method != null && (
                <Badge variant="outline" className="text-[10px]">
                  {paymentMethodLabel(String(d.payment_method))}
                </Badge>
              )}
              {s.status && isOrder && (
                <Badge variant="outline" className="text-[10px]">
                  {foodStatusMeta(mirrorFormStatusToFoodStatus(s.status)).label}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-semibold">
              {String(customer.name || d.name || "Guest")}
              {d.table_number ? ` · Table ${d.table_number}` : ""}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {new Date(s.created_at).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          {isOrder && d.total != null && (
            <div className="text-right">
              <div className="text-[10px] uppercase text-muted-foreground">Total</div>
              <div className="text-xl font-bold text-primary">
                {formatMoney(currency, d.total)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          {(customer.name || d.name) && (
            <InfoRow icon={User} label="Name" value={String(customer.name || d.name)} />
          )}
          {(customer.email || d.email) && (
            <InfoRow icon={Mail} label="Email" value={String(customer.email || d.email)} />
          )}
          {(customer.phone || d.phone) && (
            <InfoRow icon={Phone} label="Phone" value={String(customer.phone || d.phone)} />
          )}
          {d.order_type != null && (
            <InfoRow
              icon={ClipboardList}
              label="Order type"
              value={d.order_type === "order_ahead" ? "Order ahead" : "Dine in"}
            />
          )}
          {d.waiter_name != null && (
            <InfoRow icon={User} label="Server" value={String(d.waiter_name)} />
          )}
          {d.pickup_at != null && String(d.pickup_at) && (
            <InfoRow icon={ClipboardList} label="Pickup" value={new Date(String(d.pickup_at)).toLocaleString()} />
          )}
        </div>

        {d.notes != null && String(d.notes).trim() && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
            <span className="font-medium text-amber-800 dark:text-amber-200">Notes: </span>
            {String(d.notes)}
          </div>
        )}

        {items.length > 0 && (
          <div className="rounded-md border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Order items
            </div>
            <ul className="divide-y divide-border">
              {items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      <span className="font-medium">{String(it.qty ?? 1)}×</span> {String(it.name || "Item")}
                    </span>
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {formatMoney(currency, (Number(it.price) || 0) * (Number(it.qty) || 1))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {extraFields.length > 0 && (
          <div className="rounded-md border border-border px-3 py-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Additional details</div>
            <dl className="space-y-1 text-xs">
              {extraFields.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="min-w-[100px] capitalize text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                  <dd className="flex-1 break-words">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] text-muted-foreground"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          {showRaw ? "Hide technical data" : "Show technical data"}
        </Button>
        {showRaw && (
          <pre className="max-h-40 overflow-auto rounded border border-border bg-muted/50 p-2 text-[10px] font-mono">
            {JSON.stringify(d, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div>
        <div className="text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}

export function FormSubmissionsPanel({ submissions, hasFoodOrdering }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) => {
      const d = s.data || {};
      const c = (d.customer as Record<string, unknown>) || {};
      const blob = [
        c.name, c.email, c.phone, d.name, d.email, d.phone, d.table_number, d.notes, d.kind,
        ...(Array.isArray(d.items) ? d.items.map((it: Record<string, unknown>) => it.name) : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [submissions, search]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Submissions inbox</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasFoodOrdering
                ? "All customer submissions including menu orders, contact forms, and RSVPs."
                : "Contact forms, RSVPs, and order submissions from your flyer."}
            </p>
          </div>
          <Input
            placeholder="Search name, table, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {submissions.length === 0 ? "No submissions yet." : "No matches for your search."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <SubmissionCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
