import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { ExternalLink, Wallet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function venmoLink(handle: string, amount = "1") {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return "";
  return `https://venmo.com/?txn=pay&audience=public&recipients=${encodeURIComponent(h)}&amount=${encodeURIComponent(amount)}&note=Test`;
}
function cashappLink(handle: string, amount = "1") {
  const h = handle.replace(/^\$/, "").trim();
  if (!h) return "";
  return `https://cash.app/$${encodeURIComponent(h)}/${encodeURIComponent(amount)}`;
}
function appleCashLink(contact: string, amount = "1", currency = "$") {
  const c = contact.trim();
  if (!c) return "";
  const body = encodeURIComponent(`Sending ${currency}${amount} test`);
  if (c.includes("@")) return `mailto:${c}?body=${body}`;
  return `sms:${c.replace(/[^\d+]/g, "")}?&body=${body}`;
}

export function FlyerPaymentSettingsDialog({ open, onOpenChange }: Props) {
  const flyer = useEditorStore((s) => s.flyer);
  const setFlyer = useEditorStore((s) => s.setFlyer);

  const [venmo, setVenmo] = useState("");
  const [cashapp, setCashapp] = useState("");
  const [apple, setApple] = useState("");

  useEffect(() => {
    if (!open || !flyer) return;
    setVenmo(flyer.settings.payVenmo || "");
    setCashapp(flyer.settings.payCashapp || "");
    setApple(flyer.settings.payApplePayContact || "");
  }, [open, flyer]);

  if (!flyer) return null;

  function save() {
    if (!flyer) return;
    setFlyer({
      settings: {
        ...flyer.settings,
        payVenmo: venmo.trim() || undefined,
        payCashapp: cashapp.trim() || undefined,
        payApplePayContact: apple.trim() || undefined,
      },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Payment methods for this flyer
          </DialogTitle>
          <DialogDescription>
            When viewers check out from the cart on this flyer, they can pay you through any of the apps you set up here. Each flyer has its own handles — leave a field blank to disable that option.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Venmo username</Label>
            <div className="mt-1 flex gap-2">
              <Input value={venmo} onChange={(e) => setVenmo(e.target.value)} placeholder="jane-doe" />
              <Button
                size="sm"
                variant="outline"
                disabled={!venmo.trim()}
                onClick={() => window.open(venmoLink(venmo), "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">No @ — just the username from your Venmo profile.</p>
          </div>

          <div>
            <Label className="text-xs">Cash App $Cashtag</Label>
            <div className="mt-1 flex gap-2">
              <Input value={cashapp} onChange={(e) => setCashapp(e.target.value)} placeholder="YourCashtag" />
              <Button
                size="sm"
                variant="outline"
                disabled={!cashapp.trim()}
                onClick={() => window.open(cashappLink(cashapp), "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">No $ — just the cashtag.</p>
          </div>

          <div>
            <Label className="text-xs">Apple Cash contact (iMessage)</Label>
            <div className="mt-1 flex gap-2">
              <Input value={apple} onChange={(e) => setApple(e.target.value)} placeholder="+15551234567 or you@icloud.com" />
              <Button
                size="sm"
                variant="outline"
                disabled={!apple.trim()}
                onClick={() => window.open(appleCashLink(apple), "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Apple Pay has no public deep link to a person. We open Messages on the buyer's iPhone to your number/email — Apple Cash appears as a button inside iMessage.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
