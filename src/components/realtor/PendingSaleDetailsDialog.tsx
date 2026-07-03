import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPrice, LISTING_STATUSES, type ListingStatus } from "@/lib/realtor";

type Props = {
  flyerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type ListingSummary = {
  id: string;
  address: string | null;
  title: string;
  price_cents: number | null;
  listing_status: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
};

type Details = {
  seller_name: string;
  buyer_name: string;
  buyer_agent_name: string;
  buyer_agent_brokerage: string;
  agreed_price: string;
  earnest_money: string;
  closing_costs: string;
  contract_date: string;
  inspection_deadline: string;
  financing_deadline: string;
  closing_date: string;
  title_company: string;
  lender: string;
  contingencies: string;
  notes: string;
};

const STATUS_COPY: Record<
  ListingStatus,
  { title: string; description: string; saveToast: string }
> = {
  active: {
    title: "On market details",
    description: "Private to you and admins. Track showings, seller info, and notes for this active listing.",
    saveToast: "On market details saved",
  },
  pending: {
    title: "Pending sale details",
    description: "Private to you and admins. Track the buyer, contract, and closing info for this listing.",
    saveToast: "Pending sale details saved",
  },
  sold: {
    title: "Sold listing details",
    description: "Private to you and admins. Record the final sale, parties, and closing information.",
    saveToast: "Sold listing details saved",
  },
  draft: {
    title: "Listing details",
    description: "Private to you and admins. Notes and prep info before this listing goes live.",
    saveToast: "Listing details saved",
  },
};

const EMPTY: Details = {
  seller_name: "", buyer_name: "", buyer_agent_name: "", buyer_agent_brokerage: "",
  agreed_price: "", earnest_money: "", closing_costs: "",
  contract_date: "", inspection_deadline: "", financing_deadline: "", closing_date: "",
  title_company: "", lender: "", contingencies: "", notes: "",
};

const centsToStr = (c: number | null | undefined) => (c == null ? "" : String(c / 100));
const strToCents = (s: string) => (s ? String(Math.round(parseFloat(s) * 100)) : "");

export function PendingSaleDetailsDialog({ flyerId, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState<ListingSummary | null>(null);
  const [d, setD] = useState<Details>(EMPTY);

  useEffect(() => {
    if (!open || !flyerId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_listing_pending_details" as any, { _flyer_id: flyerId });
      if (error || !(data as any)?.ok) {
        toast.error((data as any)?.error ?? error?.message ?? "Failed to load");
        setLoading(false);
        onOpenChange(false);
        return;
      }
      const payload: any = data;
      setListing(payload.listing);
      const det = payload.details;
      if (det) {
        setD({
          seller_name: det.seller_name ?? "",
          buyer_name: det.buyer_name ?? "",
          buyer_agent_name: det.buyer_agent_name ?? "",
          buyer_agent_brokerage: det.buyer_agent_brokerage ?? "",
          agreed_price: centsToStr(det.agreed_price_cents),
          earnest_money: centsToStr(det.earnest_money_cents),
          closing_costs: centsToStr(det.closing_costs_cents),
          contract_date: det.contract_date ?? "",
          inspection_deadline: det.inspection_deadline ?? "",
          financing_deadline: det.financing_deadline ?? "",
          closing_date: det.closing_date ?? "",
          title_company: det.title_company ?? "",
          lender: det.lender ?? "",
          contingencies: det.contingencies ?? "",
          notes: det.notes ?? "",
        });
      } else {
        setD(EMPTY);
      }
      setLoading(false);
    })();
  }, [open, flyerId, onOpenChange]);

  const save = async () => {
    if (!flyerId) return;
    setSaving(true);
    const payload = {
      seller_name: d.seller_name,
      buyer_name: d.buyer_name,
      buyer_agent_name: d.buyer_agent_name,
      buyer_agent_brokerage: d.buyer_agent_brokerage,
      agreed_price_cents: strToCents(d.agreed_price),
      earnest_money_cents: strToCents(d.earnest_money),
      closing_costs_cents: strToCents(d.closing_costs),
      contract_date: d.contract_date,
      inspection_deadline: d.inspection_deadline,
      financing_deadline: d.financing_deadline,
      closing_date: d.closing_date,
      title_company: d.title_company,
      lender: d.lender,
      contingencies: d.contingencies,
      notes: d.notes,
    };
    const { data, error } = await supabase.rpc("upsert_listing_pending_details" as any, {
      _flyer_id: flyerId,
      _payload: payload,
    });
    setSaving(false);
    if (error || !(data as any)?.ok) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed to save");
      return;
    }
    const status = (listing?.listing_status ?? "pending") as ListingStatus;
    toast.success(STATUS_COPY[status]?.saveToast ?? "Details saved");
    onOpenChange(false);
  };

  const set = <K extends keyof Details>(k: K, v: string) => setD((p) => ({ ...p, [k]: v }));

  const listingStatus = (listing?.listing_status ?? "pending") as ListingStatus;
  const statusMeta = LISTING_STATUSES.find((s) => s.value === listingStatus) ?? LISTING_STATUSES[1];
  const copy = STATUS_COPY[listingStatus] ?? STATUS_COPY.pending;
  const showTransactionFields = listingStatus === "pending" || listingStatus === "sold";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {copy.title}
            <Badge className={statusMeta.className}>
              {statusMeta.shortLabel ?? statusMeta.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {loading || !listing ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-md border bg-muted/30 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Listing information
              </h3>
              <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <Row label="Address" value={listing.address ?? listing.title} />
                <Row label="Listed price" value={formatPrice(listing.price_cents)} />
                <Row label="Bedrooms" value={listing.beds != null ? String(listing.beds) : "—"} />
                <Row label="Bathrooms" value={listing.baths != null ? String(listing.baths) : "—"} />
                <Row label="Square footage" value={listing.sqft != null ? listing.sqft.toLocaleString() : "—"} />
                <Row label="Market status" value={listing.listing_status} />
              </div>
            </section>

            {showTransactionFields && (
              <>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parties</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Seller name" value={d.seller_name} onChange={(v) => set("seller_name", v)} />
                    <Field label="Buyer name" value={d.buyer_name} onChange={(v) => set("buyer_name", v)} />
                    <Field label="Buyer's agent" value={d.buyer_agent_name} onChange={(v) => set("buyer_agent_name", v)} />
                    <Field label="Buyer's agent brokerage" value={d.buyer_agent_brokerage} onChange={(v) => set("buyer_agent_brokerage", v)} />
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Financials</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Agreed purchase price ($)" value={d.agreed_price} onChange={(v) => set("agreed_price", v.replace(/[^0-9.]/g, ""))} inputMode="decimal" />
                    <Field label="Earnest money ($)" value={d.earnest_money} onChange={(v) => set("earnest_money", v.replace(/[^0-9.]/g, ""))} inputMode="decimal" />
                    <Field label="Closing costs ($)" value={d.closing_costs} onChange={(v) => set("closing_costs", v.replace(/[^0-9.]/g, ""))} inputMode="decimal" />
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key dates</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Contract date" type="date" value={d.contract_date} onChange={(v) => set("contract_date", v)} />
                    <Field label="Inspection deadline" type="date" value={d.inspection_deadline} onChange={(v) => set("inspection_deadline", v)} />
                    <Field label="Financing deadline" type="date" value={d.financing_deadline} onChange={(v) => set("financing_deadline", v)} />
                    <Field label="Closing date" type="date" value={d.closing_date} onChange={(v) => set("closing_date", v)} />
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Escrow & lending</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Title / escrow company" value={d.title_company} onChange={(v) => set("title_company", v)} />
                    <Field label="Lender" value={d.lender} onChange={(v) => set("lender", v)} />
                  </div>
                  <div>
                    <Label>Contingencies</Label>
                    <Textarea rows={2} value={d.contingencies} onChange={(e) => set("contingencies", e.target.value)} placeholder="e.g. inspection, appraisal, financing" />
                  </div>
                </section>
              </>
            )}

            {!showTransactionFields && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Listing notes</h3>
                <Field label="Seller name" value={d.seller_name} onChange={(v) => set("seller_name", v)} />
                <div>
                  <Label>Showing / marketing notes</Label>
                  <Textarea rows={2} value={d.contingencies} onChange={(e) => set("contingencies", e.target.value)} placeholder="Showing instructions, open house times, etc." />
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
              <Textarea rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                Save details
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize">{value}</span>
    </div>
  );
}

function Field({
  label, value, onChange, type, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type ?? "text"} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
