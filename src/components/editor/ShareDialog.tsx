import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Share2, RefreshCw, Loader2, ImagePlus, Clipboard, Settings2 } from "lucide-react";
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
  onUploadThumbnail?: (file: File) => Promise<void> | void;
  regenerating?: boolean;
  /** When false, hide the share controls and prompt the user to publish first. */
  isPublished?: boolean;
}

const PUBLISHED_ORIGIN = "https://interactive-flyer-studio.lovable.app";

/** Defensive guard: never let a private/preview URL be shared. */
function sanitizeShareUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isPreviewHost =
      host.endsWith("lovableproject.com") ||
      host.startsWith("id-preview--") ||
      (host.endsWith("lovable.app") && host.includes("preview"));
    // The /preview/:flyerId route is auth-gated — never share it.
    const isPrivatePath = u.pathname.startsWith("/preview/");
    if (isPreviewHost || isPrivatePath) {
      const pub = new URL(PUBLISHED_ORIGIN);
      // If the path is /preview/<id>, we can't recover a public slug — return
      // the published origin root so the recipient at least lands on the app
      // homepage instead of a login screen.
      u.protocol = pub.protocol;
      u.host = pub.host;
      if (isPrivatePath) u.pathname = "/";
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export function ShareDialog({
  open,
  onOpenChange,
  displayUrl,
  socialUrl,
  title,
  thumbnailUrl,
  onRegenerateThumbnail,
  onUploadThumbnail,
  regenerating,
  isPublished = true,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [shareOriginInput, setShareOriginInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareOriginInput(localStorage.getItem("flyerflow.shareOrigin") || "");
    }
  }, [open]);

  function saveShareOrigin() {
    const v = shareOriginInput.trim().replace(/\/$/, "");
    if (v && !/^https?:\/\//i.test(v)) {
      toast.error("Must start with https://");
      return;
    }
    if (v) localStorage.setItem("flyerflow.shareOrigin", v);
    else localStorage.removeItem("flyerflow.shareOrigin");
    toast.success("Preview server saved — reopen the dialog to refresh links");
    setShowConfig(false);
  }

  // Always sanitize before exposing to clipboard / QR / social buttons so a
  // private preview URL can never be shared by accident.
  const safeSocialUrl = sanitizeShareUrl(socialUrl);
  const safeDisplayUrl = sanitizeShareUrl(displayUrl);

  function copy() {
    // Copy the og-meta share URL so messaging apps (Messenger, iMessage, WhatsApp, etc.)
    // see the per-flyer preview image when the link is pasted.
    navigator.clipboard.writeText(safeSocialUrl);
    setCopied(true);
    toast.success("Share link copied — paste it anywhere for a rich preview");
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
        await (navigator as any).share({ title: title || "Flyer", url: safeSocialUrl });
      } catch {}
    } else {
      copy();
    }
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          await onUploadThumbnail?.(new File([blob], "pasted-preview.png", { type: imageType }));
          return;
        }
      }
      toast.error("Clipboard doesn't contain an image");
    } catch {
      toast.error("Paste is blocked by the browser. Use Upload image instead.");
    }
  }

  // Social-share buttons use the og-meta URL so platforms see the per-flyer preview.
  const shareLinks = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(safeSocialUrl)}` },
    { label: "X / Twitter", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(safeSocialUrl)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(safeSocialUrl)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(safeSocialUrl)}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(title || "Check this out")}&body=${encodeURIComponent(safeSocialUrl)}` },
  ];

  if (!isPublished) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish your flyer to share it</DialogTitle>
            <DialogDescription>
              Your flyer needs to be published before you can share a public link. Click the
              <strong> Publish </strong> button in the top bar — then anyone with the link can
              view your flyer without logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Note: the <code>/preview/...</code> URL from the Preview button is private and only
            works for you. Always use the link from this dialog (after publishing) when sending
            your flyer to others.
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share your flyer</DialogTitle>
          <DialogDescription>Anyone with the link can view it. Social previews show your flyer.</DialogDescription>
        </DialogHeader>

        <div className="mx-auto w-fit max-h-[55vh] overflow-hidden rounded-lg border border-border bg-muted/30">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`${title || "Flyer"} social preview`}
              className="block h-auto max-h-[55vh] w-auto max-w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-56 w-44 items-center justify-center text-xs text-muted-foreground">
              {regenerating ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Generating preview…</span>
              ) : (
                <span>No social preview yet</span>
              )}
            </div>
          )}
        </div>

        {onRegenerateThumbnail && (
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUploadThumbnail?.(file);
                e.currentTarget.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={regenerating}>
              <ImagePlus className="mr-1 h-3.5 w-3.5" /> Upload image
            </Button>
            <Button size="sm" variant="outline" onClick={pasteImage} disabled={regenerating || !onUploadThumbnail}>
              <Clipboard className="mr-1 h-3.5 w-3.5" /> Paste image
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRegenerateThumbnail()} disabled={regenerating}>
              {regenerating ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Updating…</>
              ) : (
                <><RefreshCw className="mr-1 h-3.5 w-3.5" /> Auto capture</>
              )}
            </Button>
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <QRCodeCanvas id="share-qr-canvas" value={safeSocialUrl} size={160} level="M" includeMargin={false} />
          </div>
          <div className="flex w-full gap-2">
            <Input readOnly value={safeSocialUrl} className="flex-1 text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="-mt-2 w-full text-[11px] text-muted-foreground">
            This link unfurls with your flyer preview in Messenger, WhatsApp, iMessage, etc.
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
