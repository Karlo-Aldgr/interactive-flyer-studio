import { useState } from "react";
import { Link } from "react-router-dom";
import { useEditorStore, ResizeMode } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, Undo2, Redo2, Eye, Globe, Loader2, ZoomIn, ZoomOut,
  Crosshair, Monitor, Tablet, Smartphone, Crop, Share2, Sparkles, DollarSign, Music,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateAndUploadThumbnail, uploadManualThumbnail } from "@/lib/thumbnail";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareDialog } from "./ShareDialog";
import { PaymentLinkDialog } from "./PaymentLinkDialog";

interface Props { saving: boolean }

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 7);
}

function getShareOrigin() {
  const origin = window.location.origin;
  return origin.includes("lovable.app") && origin.includes("preview")
    ? "https://interactive-flyer-studio.lovable.app"
    : origin;
}

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Story 9:16 (1080×1920)", w: 1080, h: 1920 },
  { label: "Portrait 4:5 (1080×1350)", w: 1080, h: 1350 },
  { label: "Square 1:1 (1080×1080)", w: 1080, h: 1080 },
  { label: "Landscape 16:9 (1920×1080)", w: 1920, h: 1080 },
  { label: "A4 Portrait (2480×3508)", w: 2480, h: 3508 },
  { label: "Default (900×1200)", w: 900, h: 1200 },
];

export function TopBar({ saving }: Props) {
  const flyer = useEditorStore((s) => s.flyer);
  const setFlyer = useEditorStore((s) => s.setFlyer);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past.length);
  const future = useEditorStore((s) => s.future.length);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const showHitboxes = useEditorStore((s) => s.showHitboxes);
  const toggleHitboxes = useEditorStore((s) => s.toggleHitboxes);
  const deviceFrame = useEditorStore((s) => s.deviceFrame);
  const setDeviceFrame = useEditorStore((s) => s.setDeviceFrame);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);
  const startCrop = useEditorStore((s) => s.startCrop);

  const [resizeOpen, setResizeOpen] = useState(false);
  const [presetIdx, setPresetIdx] = useState<string>("0");
  const [customW, setCustomW] = useState(1080);
  const [customH, setCustomH] = useState(1920);
  const [useCustom, setUseCustom] = useState(false);
  const [mode, setMode] = useState<ResizeMode>("resize");
  const [shareOpen, setShareOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [localThumbnail, setLocalThumbnail] = useState<string | undefined>(undefined);
  const [payOpen, setPayOpen] = useState(false);

  if (!flyer) return null;

  async function ensureThumbnail(force = false) {
    if (!flyer) return;
    if (!force && flyer.thumbnail_url) return;
    setRegenerating(true);
    try {
      const store = useEditorStore.getState();
      const firstPage = store.pages[0];
      if (!firstPage) return;
      if (store.selectedPageId !== firstPage.id) {
        store.selectPage(firstPage.id);
        await new Promise((r) => setTimeout(r, 300));
      } else {
        await new Promise((r) => setTimeout(r, 80));
      }
      const stage = useEditorStore.getState().stageRef;
      if (!stage) {
        toast.error("Couldn't capture the page. Try again.");
        return;
      }
      try {
        const url = await generateAndUploadThumbnail(
          stage,
          flyer.id,
          flyer.settings.width,
          flyer.settings.height,
          firstPage.background?.color || flyer.settings.background || "#ffffff"
        );
        setLocalThumbnail(url);
        const cleanUrl = url.split("?")[0];
        setFlyer({ thumbnail_url: cleanUrl });
        if (force) toast.success("Social preview updated");
      } catch (e: any) {
        console.error("[ensureThumbnail]", e);
        toast.error(e?.message || "Could not generate preview");
      }
    } finally {
      setRegenerating(false);
    }
  }

  async function uploadSocialPreview(file: File) {
    if (!flyer) return;
    setRegenerating(true);
    try {
      const url = await uploadManualThumbnail(file, flyer.id);
      setLocalThumbnail(url);
      setFlyer({ thumbnail_url: url.split("?")[0] });
      toast.success("Social preview image updated");
    } catch (e: any) {
      console.error("[uploadSocialPreview]", e);
      toast.error(e?.message || "Could not upload preview image");
    } finally {
      setRegenerating(false);
    }
  }

  function openShare() {
    setShareOpen(true);
    // Auto-generate if missing.
    if (!flyer?.thumbnail_url) {
      void ensureThumbnail(false);
    }
  }

  async function togglePublish() {
    if (!flyer) return;
    const newStatus = flyer.status === "published" ? "draft" : "published";
    let slug = flyer.public_slug;
    if (newStatus === "published" && !slug) {
      slug = slugify(flyer.title || "flyer");
    }
    setFlyer({ status: newStatus, public_slug: slug });
    const { error } = await supabase.from("flyers").update({ status: newStatus, public_slug: slug }).eq("id", flyer.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "published" ? "Published!" : "Unpublished");

    // On publish, capture a fresh social thumbnail of page 1.
    if (newStatus === "published") {
      const store = useEditorStore.getState();
      const firstPage = store.pages[0];
      if (firstPage) {
        // Switch to page 1 if not already there, wait a tick for konva to render.
        if (store.selectedPageId !== firstPage.id) {
          store.selectPage(firstPage.id);
          await new Promise((r) => setTimeout(r, 250));
        } else {
          await new Promise((r) => setTimeout(r, 50));
        }
        const stage = useEditorStore.getState().stageRef;
        if (stage) {
          try {
            await generateAndUploadThumbnail(
              stage,
              flyer.id,
              flyer.settings.width,
              flyer.settings.height,
              firstPage.background?.color || flyer.settings.background || "#ffffff"
            );
          } catch (e) {
            console.warn("[publish] thumbnail capture failed", e);
          }
        }
      }
    }
  }

  function applyResize() {
    const target = useCustom
      ? { w: Math.max(100, customW), h: Math.max(100, customH) }
      : { w: PRESETS[Number(presetIdx)].w, h: PRESETS[Number(presetIdx)].h };
    if (mode === "crop") {
      startCrop({ width: target.w, height: target.h });
      toast.message("Drag the crop area on the canvas, then confirm.");
    } else {
      setCanvasSize(target.w, target.h, mode);
      toast.success(`Canvas resized to ${target.w} × ${target.h}`);
    }
    setResizeOpen(false);
  }

  const viewerUrl = flyer.public_slug ? `${getShareOrigin()}/f/${flyer.public_slug}` : "";
  // The "social URL" is what gets pasted into Messenger/WhatsApp/etc. It must
  // hit a server that returns clean HTML with per-flyer OG tags. We use a
  // Cloudflare Worker for this (see /worker/README.md). If no Worker is
  // configured yet, fall back to the viewer URL — previews will be generic
  // until the Worker is set up.
  const shareOrigin =
    (typeof window !== "undefined" && localStorage.getItem("flyerflow.shareOrigin")) ||
    (import.meta as any).env?.VITE_SHARE_ORIGIN ||
    "";
  const socialUrl =
    shareOrigin && flyer.public_slug
      ? `${shareOrigin.replace(/\/$/, "")}/f/${flyer.public_slug}`
      : viewerUrl;

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-3">
      <Button asChild variant="ghost" size="sm">
        <Link to="/dashboard"><ChevronLeft className="mr-1 h-4 w-4" />Dashboard</Link>
      </Button>
      <Input
        className="h-8 max-w-xs border-transparent bg-transparent font-semibold focus-visible:border-input"
        value={flyer.title}
        onChange={(e) => setFlyer({ title: e.target.value })}
      />
      <div className="ml-2 flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} disabled={!past}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} disabled={!future}>
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Device frame preview */}
      <div className="ml-2 flex items-center rounded-md border border-border p-0.5">
        {([
          { f: "desktop" as const, I: Monitor },
          { f: "tablet" as const, I: Tablet },
          { f: "mobile" as const, I: Smartphone },
        ]).map(({ f, I }) => (
          <Tooltip key={f}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={deviceFrame === f ? "default" : "ghost"}
                className="h-7 w-7"
                onClick={() => setDeviceFrame(f)}
              >
                <I className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Preview as {f}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Canvas size dialog trigger */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setResizeOpen(true)}>
            <Crop className="mr-1 h-3.5 w-3.5" />
            {flyer.settings.width}×{flyer.settings.height}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Change canvas size or crop</TooltipContent>
      </Tooltip>

      {/* Hitbox toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={showHitboxes ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={toggleHitboxes}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Show clickable areas</TooltipContent>
      </Tooltip>

      {/* Global highlights toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={(flyer.settings.highlightsEnabled ?? true) ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={() =>
              setFlyer({
                settings: {
                  ...flyer.settings,
                  highlightsEnabled: !(flyer.settings.highlightsEnabled ?? true),
                },
              })
            }
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {(flyer.settings.highlightsEnabled ?? true)
            ? "Tap highlights ON — click to disable for all layers"
            : "Tap highlights OFF — click to enable"}
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(zoom - 0.1)}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(zoom + 0.1)}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {saving ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving...</span> : "Saved"}
        </span>
        <Button asChild size="sm" variant="outline">
          <a href={`/preview/${flyer.id}`} target="_blank" rel="noreferrer"><Eye className="mr-1 h-4 w-4" />Preview</a>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
              <DollarSign className="mr-1 h-4 w-4" /> Pay link
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate a Venmo / Cash App / PayPal link to send to customers</TooltipContent>
        </Tooltip>
        {flyer.status === "published" && (
          <Button size="sm" variant="outline" onClick={openShare}>
            <Share2 className="mr-1 h-4 w-4" /> Share
          </Button>
        )}
        <Button size="sm" onClick={togglePublish} className={flyer.status === "published" ? "" : "shadow-glow"}>
          <Globe className="mr-1 h-4 w-4" />
          {flyer.status === "published" ? "Unpublish" : "Publish"}
        </Button>
      </div>

      {/* Resize Dialog */}
      <Dialog open={resizeOpen} onOpenChange={setResizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Canvas size</DialogTitle>
            <DialogDescription>Pick a preset or enter custom dimensions, then choose how layers adapt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Preset</Label>
              <Select
                value={useCustom ? "custom" : presetIdx}
                onValueChange={(v) => {
                  if (v === "custom") setUseCustom(true);
                  else { setUseCustom(false); setPresetIdx(v); }
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p, i) => (
                    <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {useCustom && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Width</Label>
                  <Input type="number" min={100} value={customW} onChange={(e) => setCustomW(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Height</Label>
                  <Input type="number" min={100} value={customH} onChange={(e) => setCustomH(Number(e.target.value))} />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">How should existing layers adapt?</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ResizeMode)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resize">Resize canvas only (keep layers in place)</SelectItem>
                  <SelectItem value="scale">Scale layers to fit new size</SelectItem>
                  <SelectItem value="crop">Crop — drag region on canvas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResizeOpen(false)}>Cancel</Button>
            <Button onClick={applyResize}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        displayUrl={viewerUrl}
        socialUrl={socialUrl}
        title={flyer.title}
        thumbnailUrl={localThumbnail ?? flyer.thumbnail_url ?? undefined}
        onRegenerateThumbnail={() => ensureThumbnail(true)}
        onUploadThumbnail={uploadSocialPreview}
        regenerating={regenerating}
      />

      <PaymentLinkDialog open={payOpen} onOpenChange={setPayOpen} />
    </header>
  );
}
