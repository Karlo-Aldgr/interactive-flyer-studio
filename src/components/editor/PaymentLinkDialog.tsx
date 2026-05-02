import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink, DollarSign } from "lucide-react";
import { toast } from "sonner";

type Provider = "venmo" | "cashapp" | "paypal";

const STORAGE_KEYS = {
  provider: "flyerflow.payProvider",
  venmo: "flyerflow.payHandle.venmo",
  cashapp: "flyerflow.payHandle.cashapp",
  paypal: "flyerflow.payHandle.paypal",
};

function buildLink(provider: Provider, handle: string, amount: string, note: string): string {
  const cleanHandle = handle.replace(/^@/, "").trim();
  const amt = amount.trim();
  const n = encodeURIComponent(note.trim());
  if (!cleanHandle) return "";
  switch (provider) {
    case "venmo":
      // Venmo deep link — opens app on mobile, web on desktop with payment pre-filled.
      return `https://venmo.com/?txn=pay&audience=public&recipients=${encodeURIComponent(cleanHandle)}${
        amt ? `&amount=${encodeURIComponent(amt)}` : ""
      }${n ? `&note=${n}` : ""}`;
    case "cashapp":
      // Cash App: https://cash.app/$handle/amount
      return amt
        ? `https://cash.app/$${encodeURIComponent(cleanHandle)}/${encodeURIComponent(amt)}`
        : `https://cash.app/$${encodeURIComponent(cleanHandle)}`;
    case "paypal":
      // PayPal.me: https://paypal.me/handle/amount
      return amt
        ? `https://paypal.me/${encodeURIComponent(cleanHandle)}/${encodeURIComponent(amt)}`
        : `https://paypal.me/${encodeURIComponent(cleanHandle)}`;
  }
}

export function PaymentLinkDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [provider, setProvider] = useState<Provider>("venmo");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Load saved provider + handles from localStorage on open.
  useEffect(() => {
    if (!open) return;
    const savedProvider = (localStorage.getItem(STORAGE_KEYS.provider) as Provider) || "venmo";
    setProvider(savedProvider);
    setHandle(localStorage.getItem(STORAGE_KEYS[savedProvider]) || "");
  }, [open]);

  // When provider changes, swap handle to the one saved for that provider.
  useEffect(() => {
    if (!open) return;
    setHandle(localStorage.getItem(STORAGE_KEYS[provider]) || "");
    localStorage.setItem(STORAGE_KEYS.provider, provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Persist handle as it's typed.
  useEffect(() => {
    if (!open) return;
    localStorage.setItem(STORAGE_KEYS[provider], handle);
  }, [handle, provider, open]);

  const link = useMemo(
    () => buildLink(provider, handle, amount, note),
    [provider, handle, amount, note]
  );

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Payment link copied — paste it to your customer.");
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy manually.");
    }
  }

  const placeholderHandle = provider === "venmo" ? "your-venmo-username"
    : provider === "cashapp" ? "YourCashtag"
    : "your-paypalme";

  const helper = provider === "venmo"
    ? "Find your username in the Venmo app under your profile (e.g. @jane-doe → enter jane-doe)."
    : provider === "cashapp"
    ? "Your $Cashtag from Cash App (without the $)."
    : "Your PayPal.me link name.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Generate payment link
          </DialogTitle>
          <DialogDescription>
            Create a link your customer can tap to pay you a custom amount. No fees, no setup —
            it opens directly in their payment app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Payment app</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venmo">Venmo</SelectItem>
                <SelectItem value="cashapp">Cash App</SelectItem>
                <SelectItem value="paypal">PayPal.me</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Your username</Label>
            <Input
              className="mt-1"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={placeholderHandle}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Amount (USD)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="mt-1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50.00"
              />
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Input
                className="mt-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Flyer design"
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Your payment link
            </Label>
            <div className="mt-1 break-all rounded bg-background p-2 text-xs font-mono">
              {link || <span className="text-muted-foreground">Enter your username and amount above…</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="flex-1" onClick={copy} disabled={!link}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
              </Button>
              <Button size="sm" variant="outline" asChild disabled={!link}>
                <a href={link || "#"} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Test
                </a>
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            💡 Tip: You can also add this link inside your flyer — select any layer, choose
            <strong> Action → Open URL</strong>, and paste the payment link there.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
