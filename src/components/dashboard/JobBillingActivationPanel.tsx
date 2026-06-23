import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { ExternalLink, Copy, Download, Eye, Lock, Power, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { buildPublicFlyerUrl } from "@/lib/utils";
import { formatJobPrice, type UserJob } from "@/lib/userJobs";
import { getUnifiedStatusLabel } from "@/lib/jobStatus";
import { customerSetFlyerActive } from "@/lib/customerJobs";

type Props = {
  job: UserJob;
  onJobChanged?: (patch: Partial<UserJob>) => void;
};

export function JobBillingActivationPanel({ job, onJobChanged }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [toggling, setToggling] = useState(false);

  const status = getUnifiedStatusLabel(job);
  const price = formatJobPrice(job.price_cents);
  const hasPrice = typeof job.price_cents === "number" && job.price_cents > 0;
  const paid = !!job.share_unlocked || job.status === "paid";
  const paymentRequired = hasPrice && !paid;
  const previewable = !!job.flyer_id && (job.preview_ready || job.status === "preview_ready" || job.status === "delivered" || paid);
  const shareUrl = paid && job.flyer?.public_slug ? buildPublicFlyerUrl(job.flyer.public_slug) : null;
  const active = job.flyer_active !== false;
  const publicLive = paid && active && !!shareUrl;

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.title || "flyer"}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onToggleActive = async (next: boolean) => {
    setToggling(true);
    const { ok, error } = await customerSetFlyerActive(job.id, next);
    setToggling(false);
    if (!ok) return toast.error(error || "Could not update");
    toast.success(next ? "Flyer is now active" : "Flyer is now inactive");
    onJobChanged?.({ flyer_active: next });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Billing & Activation</h2>
          <p className="text-sm text-muted-foreground">
            Preview your flyer, complete payment, and share when ready.
          </p>
        </div>
        <Badge className={status.className}>
          <span className="mr-1">{status.emoji}</span>
          {status.label}
        </Badge>
      </div>

      {/* Preview always available when flyer exists */}
      {previewable && job.flyer_id && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
          <div className="text-sm">
            <div className="font-medium">Flyer preview</div>
            <div className="text-xs text-muted-foreground">
              {publicLive
                ? "Live and shareable."
                : "Tap through your interactive flyer privately."}
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <a
              href={publicLive && job.flyer?.public_slug ? `/f/${job.flyer.public_slug}` : `/preview/${job.flyer_id}`}
              target="_blank"
              rel="noreferrer"
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              Preview flyer
            </a>
          </Button>
        </div>
      )}

      <Separator />

      {/* Pricing & payment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Project price</span>
          <span className="font-semibold">{price ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Payment status</span>
          <span className={paid ? "font-semibold text-emerald-600" : "font-semibold"}>
            {paid ? "Paid" : "Unpaid"}
          </span>
        </div>

        {paymentRequired && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 space-y-2">
            <div className="font-medium">💰 Payment Required</div>
            <p className="text-xs text-muted-foreground">
              Unlock your shareable flyer link and QR code.
            </p>
            {job.payment_link ? (
              <Button asChild size="sm" className="w-full shadow-glow">
                <a href={job.payment_link} target="_blank" rel="noreferrer">
                  Pay {price} now <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Awaiting payment link from our team.</p>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Share + QR */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Share link</div>
            <div className="text-xs text-muted-foreground">
              {publicLive ? "Anyone with this link can open your flyer." : paid ? "Activate your flyer to share." : "Locked — complete payment to unlock."}
            </div>
          </div>
          {!paid && <Lock className="h-4 w-4 text-muted-foreground" />}
        </div>

        {publicLive && shareUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" variant="outline" onClick={copyShare}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">QR code</div>
            <div className="text-xs text-muted-foreground">
              {publicLive ? "Print or share for instant scan." : "Locked until paid and active."}
            </div>
          </div>
          {publicLive && shareUrl ? (
            <div className="flex flex-col items-center gap-2">
              <div ref={qrRef} className="rounded-md bg-white p-2">
                <QRCodeCanvas value={shareUrl} size={112} includeMargin={false} />
              </div>
              <Button size="sm" variant="outline" onClick={downloadQR}>
                <Download className="mr-1 h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
              <Lock className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>

      {paid && (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <Power className={active ? "h-4 w-4 text-emerald-600 mt-0.5" : "h-4 w-4 text-muted-foreground mt-0.5"} />
              <div>
                <div className="text-sm font-medium">
                  {active ? "Active" : "Inactive"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {active
                    ? "Public link and QR are live."
                    : "Public link disabled. Your data is preserved."}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Switch checked={active} disabled={toggling} onCheckedChange={onToggleActive} />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
