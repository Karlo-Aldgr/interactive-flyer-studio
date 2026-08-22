import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Share2, RefreshCw, Loader2, ImagePlus, Clipboard } from "lucide-react";
import { getPublicAppOrigin, isLovablePreviewHost } from "@/lib/utils";
import { safeCopyToClipboard } from "@/lib/safeBrowser";
import { toast } from "sonner";

interface ExtraLink {
  label: string;
  url: string;
  description?: string;
}

interface PreviewSection {
  label: string;
  description?: string;
  thumbnailUrl?: string;
  url: string;
}

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
  /** Optional additional links shown below the primary share link (legacy single-column mode). */
  extraLinks?: ExtraLink[];
  /** When provided, switches the dialog into a two-column layout: landing on the left, flyer on the right. */
  flyerPreview?: PreviewSection;
  /** Override the label/description for the primary (left) preview when in two-column mode. Defaults to "Landing page". */
  landingPreviewMeta?: { label?: string; description?: string };
}

/** Defensive guard: never let a private/preview URL be shared. */
function sanitizeShareUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    const isPrivatePath = u.pathname.startsWith("/preview/");
    if (isLovablePreviewHost(u.hostname) || isPrivatePath) {
      const pub = new URL(getPublicAppOrigin());
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
  extraLinks,
  flyerPreview,
  landingPreviewMeta,
}: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const safeSocialUrl = sanitizeShareUrl(socialUrl);
  const safeDisplayUrl = sanitizeShareUrl(displayUrl);
  const safeExtraLinks = (extraLinks ?? []).map((l) => ({ ...l, url: sanitizeShareUrl(l.url) }));
  const safeFlyerPreview = flyerPreview
    ? { ...flyerPreview, url: sanitizeShareUrl(flyerPreview.url) }
    : undefined;

  const twoColumn = !!safeFlyerPreview;

  async function copyText(key: string, url: string, msg = "Link copied") {
    const ok = await safeCopyToClipboard(url);
    if (!ok) {
      toast.error("Couldn't copy automatically — long-press or select the link to copy.");
      return;
    }
    setCopiedKey(key);
    toast.success(msg);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  }

  function downloadQR(canvasId = "share-qr-canvas", suffix = "") {
    const hdCanvas = document.getElementById(`${canvasId}-hd`) as HTMLCanvasElement | null;
    const canvas = hdCanvas ?? (document.getElementById(canvasId) as HTMLCanvasElement | null);
    if (!canvas) return;
    const link = document.createElement("a");
    const base = (title || "flyer").replace(/[^a-z0-9]+/gi, "-");
    link.download = `${base}${suffix ? `-${suffix}` : ""}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: title || "Flyer", url: safeSocialUrl });
      } catch {}
    } else {
      copyText("primary", safeSocialUrl, "Share link copied");
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

  const landingMeta = {
    label: landingPreviewMeta?.label ?? "Landing page",
    description:
      landingPreviewMeta?.description ?? "Opens the landing page first.",
  };

  function PreviewCard({
    section,
    qrId,
    fileSlug,
    keyName,
    accent,
    hidePreview,
  }: {
    section: { label: string; description?: string; thumbnailUrl?: string; url: string };
    qrId: string;
    fileSlug: string;
    keyName: string;
    accent?: string;
    hidePreview?: boolean;
  }) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <div className="flex items-center justify-between">
            <div className={`text-sm font-semibold ${accent ?? ""}`}>{section.label}</div>
          </div>
          {section.description && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">{section.description}</div>
          )}
        </div>

        {!hidePreview && (
        <div className="mx-auto w-full max-h-[40vh] overflow-hidden rounded-md border border-border bg-muted/30">
          {section.thumbnailUrl ? (
            <img
              src={section.thumbnailUrl}
              alt={`${section.label} preview`}
              className="block h-auto max-h-[40vh] w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center text-xs text-muted-foreground">
              {regenerating ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Generating preview…</span>
              ) : (
                <span>No preview yet</span>
              )}
            </div>
          )}
        </div>
        )}


        <div className="flex items-start gap-3">
          <div className="relative rounded-md bg-white p-2 shadow-sm shrink-0">
            <QRCodeCanvas id={qrId} value={section.url} size={104} level="M" includeMargin={false} />
            <div className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
              <QRCodeCanvas id={`${qrId}-hd`} value={section.url} size={512} level="M" includeMargin={false} />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Input
              readOnly
              value={section.url}
              className="text-xs"
              onFocus={(e) => e.target.select()}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => copyText(keyName, section.url)}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                {copiedKey === keyName ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => downloadQR(qrId, fileSlug)}>
                <Download className="mr-1 h-3.5 w-3.5" /> QR
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-h-[92vh] overflow-y-auto ${twoColumn ? "sm:max-w-5xl" : ""}`}
      >
        <DialogHeader>
          <DialogTitle>Share your flyer</DialogTitle>
          <DialogDescription>
            {twoColumn
              ? "Two share links are active. Use the landing page link if you want viewers to see the landing first, or the direct flyer link to skip straight to the flyer."
              : "Anyone with the link can view it. Social previews show your flyer."}
          </DialogDescription>
        </DialogHeader>

        {twoColumn ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <PreviewCard
                section={{
                  label: landingMeta.label,
                  description: landingMeta.description,
                  thumbnailUrl,
                  url: safeDisplayUrl, // landing url passed via displayUrl
                }}
                qrId="share-qr-landing"
                fileSlug="landing"
                keyName="landing"
                accent="text-primary"
              />
              <PreviewCard
                section={safeFlyerPreview!}
                qrId="share-qr-flyer"
                fileSlug="flyer"
                keyName="flyer"
                accent="text-primary"
              />
            </div>

            {safeExtraLinks.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {safeExtraLinks.map((l, i) => (
                  <PreviewCard
                    key={l.label}
                    section={{ label: l.label, description: l.description, url: l.url }}
                    qrId={`share-qr-extra-${i}`}
                    fileSlug={l.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                    keyName={`extra-${i}`}
                    accent="text-primary"
                    hidePreview
                  />
                ))}
              </div>
            )}



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
                  <ImagePlus className="mr-1 h-3.5 w-3.5" /> Upload landing image
                </Button>
                <Button size="sm" variant="outline" onClick={pasteImage} disabled={regenerating || !onUploadThumbnail}>
                  <Clipboard className="mr-1 h-3.5 w-3.5" /> Paste landing image
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRegenerateThumbnail()} disabled={regenerating}>
                  {regenerating ? (
                    <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Updating…</>
                  ) : (
                    <><RefreshCw className="mr-1 h-3.5 w-3.5" /> Auto-capture previews</>
                  )}
                </Button>
              </div>
            )}

            <div className="flex w-full items-center justify-end gap-2">
              <Button size="sm" onClick={nativeShare}>
                <Share2 className="mr-1 h-3.5 w-3.5" /> Share
              </Button>
            </div>

            <div className="flex w-full flex-wrap gap-2 border-t border-border pt-3">
              <span className="text-[11px] text-muted-foreground">Quick share (uses direct flyer link):</span>
              {shareLinks.map((s) => (
                <Button key={s.label} asChild size="sm" variant="ghost" className="text-xs">
                  <a href={s.href} target="_blank" rel="noreferrer">{s.label}</a>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
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
            <div className="relative rounded-lg bg-white p-4 shadow-sm">
              <QRCodeCanvas id="share-qr-canvas" value={safeSocialUrl} size={160} level="M" includeMargin={false} />
              <div className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
                <QRCodeCanvas id="share-qr-canvas-hd" value={safeSocialUrl} size={512} level="M" includeMargin={false} />
              </div>
            </div>
              <div className="flex w-full gap-2">
                <Input readOnly value={safeSocialUrl} className="flex-1 text-xs" onFocus={(e) => e.target.select()} />
                <Button size="sm" variant="outline" onClick={() => copyText("primary", safeSocialUrl, "Share link copied")}>
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {copiedKey === "primary" ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="-mt-2 w-full text-[11px] text-muted-foreground">
                This link unfurls with your flyer preview in Messenger, WhatsApp, iMessage, etc.
              </div>
              {safeExtraLinks.length > 0 && (
                <div className="w-full space-y-3 rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Other share links
                  </div>
                  {safeExtraLinks.map((l, i) => {
                    const canvasId = `share-qr-extra-${i}`;
                    const slug = l.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    return (
                      <div key={l.label} className="space-y-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium">{l.label}</span>
                          {l.description && (
                            <span className="text-muted-foreground">{l.description}</span>
                          )}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="relative rounded-lg bg-white p-2 shadow-sm shrink-0">
                            <QRCodeCanvas id={canvasId} value={l.url} size={96} level="M" includeMargin={false} />
                            <div className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
                              <QRCodeCanvas id={`${canvasId}-hd`} value={l.url} size={512} level="M" includeMargin={false} />
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col gap-2">
                            <Input
                              readOnly
                              value={l.url}
                              className="text-xs"
                              onFocus={(e) => e.target.select()}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1" onClick={() => copyText(`extra-${i}`, l.url)}>
                                <Copy className="mr-1 h-3.5 w-3.5" />
                                {copiedKey === `extra-${i}` ? "Copied" : "Copy"}
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1" onClick={() => downloadQR(canvasId, slug)}>
                                <Download className="mr-1 h-3.5 w-3.5" /> QR
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex w-full gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => downloadQR()}>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
