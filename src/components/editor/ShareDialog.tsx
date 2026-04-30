import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Share2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Friendly URL shown in UI and copied by users (e.g. /f/slug). */
  displayUrl: string;
  /** URL passed to social platforms for OG scraping (the og-meta edge function). */
  socialUrl: string;
  title?: string;
  thumbnailUrl?: string;
  onRegenerateThumbnail?: () => Promise<void> | void;
  regenerating?: boolean;
}

export function ShareDialog({
  open,
  onOpenChange,
  displayUrl,
  socialUrl,
  title,
  thumbnailUrl,
  onRegenerateThumbnail,
  regenerating,
}: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadQR() {
    const canvas = document.getElementById("share-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${(title || "flyer").replace(/[^a-z0-9]+/gi, "-")}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: title || "Flyer", url: displayUrl });
      } catch {}
    } else {
      copy();
    }
  }

  // Social-share buttons use the og-meta URL so platforms see the per-flyer preview.
  const shareLinks = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(socialUrl)}` },
    { label: "X / Twitter", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(socialUrl)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(socialUrl)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(socialUrl)}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(title || "Check this out")}&body=${encodeURIComponent(socialUrl)}` },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share your flyer</DialogTitle>
          <DialogDescription>Anyone with the link can view it. Social previews show your flyer.</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`${title || "Flyer"} social preview`}
              className="block h-auto w-full"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-[1200/630] w-full items-center justify-center text-xs text-muted-foreground">
              {regenerating ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Generating preview…</span>
              ) : (
                <span>No social preview yet</span>
              )}
            </div>
          )}
        </div>

        {onRegenerateThumbnail && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onRegenerateThumbnail()}
            disabled={regenerating}
          >
            {regenerating ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Generating preview…</>
            ) : (
              <><RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate social preview</>
            )}
          </Button>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <QRCodeCanvas id="share-qr-canvas" value={displayUrl} size={200} level="M" includeMargin={false} />
          </div>
          <div className="flex w-full gap-2">
            <Input readOnly value={displayUrl} className="flex-1 text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex w-full gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={downloadQR}>
              <Download className="mr-1 h-3.5 w-3.5" /> Download QR
            </Button>
            <Button size="sm" className="flex-1" onClick={nativeShare}>
              <Share2 className="mr-1 h-3.5 w-3.5" /> Share
            </Button>
          </div>
          <div className="flex w-full flex-wrap gap-2">
            {shareLinks.map((s) => (
              <Button key={s.label} asChild size="sm" variant="ghost" className="text-xs">
                <a href={s.href} target="_blank" rel="noreferrer">{s.label}</a>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
