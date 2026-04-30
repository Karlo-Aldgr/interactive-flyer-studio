import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  title?: string;
  thumbnailUrl?: string;
}

export function ShareDialog({ open, onOpenChange, url, title, thumbnailUrl }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url);
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
        await (navigator as any).share({ title: title || "Flyer", url });
      } catch {}
    } else {
      copy();
    }
  }

  const shareLinks = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(url)}` },
    { label: "X / Twitter", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(title || "Check this out")}&body=${encodeURIComponent(url)}` },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share your flyer</DialogTitle>
          <DialogDescription>Anyone with the link can view it. Social previews show your flyer.</DialogDescription>
        </DialogHeader>

        {thumbnailUrl && (
          <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
            <img
              src={thumbnailUrl}
              alt={`${title || "Flyer"} social preview`}
              className="block h-auto w-full"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <QRCodeCanvas id="share-qr-canvas" value={url} size={200} level="M" includeMargin={false} />
          </div>
          <div className="flex w-full gap-2">
            <Input readOnly value={url} className="flex-1 text-xs" onFocus={(e) => e.target.select()} />
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
