import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useEditorStore, ResizeMode } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, Undo2, Redo2, Eye, Globe, Loader2, ZoomIn, ZoomOut,
  Crosshair, Monitor, Tablet, Smartphone, Crop, Share2, Sparkles, DollarSign, Music, BarChart3, Users, Wallet, Inbox, Link as LinkIcon,
  Briefcase, PartyPopper, CalendarIcon,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn, flyerSlugLooksUntitled, isRealFlyerTitle, slugFromFlyerTitle } from "@/lib/utils";
import type { FlyerCategory } from "@/types/flyer";
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
import { FlyerPaymentSettingsDialog } from "./FlyerPaymentSettingsDialog";
import { IntroAudioDialog } from "./IntroAudioDialog";
import { SubscribersPanel } from "./SubscribersPanel";
import { PortalLinkDialog } from "./PortalLinkDialog";

interface Props { saving: boolean }

// Public origin where the flyer is published. We must NEVER hand out a URL
// pointing at the Lovable preview sandbox (lovableproject.com / id-preview--*),
// because those hosts require a Lovable login and recipients will be bounced
// to a sign-in screen. Always rewrite to the published .lovable.app domain.
const PUBLISHED_ORIGIN = "https://interactive-flyer-studio.lovable.app";
function getShareOrigin() {
  if (typeof window === "undefined") return PUBLISHED_ORIGIN;
  const origin = window.location.origin;
  const isPreviewSandbox =
    origin.includes("lovableproject.com") ||
    origin.includes("id-preview--") ||
    (origin.includes("lovable.app") && origin.includes("preview"));
  return isPreviewSandbox ? PUBLISHED_ORIGIN : origin;
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
  const pagesForLinks = useEditorStore((s) => s.pages);

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
  const [introAudioOpen, setIntroAudioOpen] = useState(false);
  const [subscribersOpen, setSubscribersOpen] = useState(false);
  const [paySettingsOpen, setPaySettingsOpen] = useState(false);
  const [portalLinkOpen, setPortalLinkOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<FlyerCategory>(((flyer as any)?.category as FlyerCategory) || "business");
  const [editEventDate, setEditEventDate] = useState<Date | undefined>(
    (flyer as any)?.event_date ? new Date(((flyer as any).event_date as string) + "T00:00:00") : undefined
  );
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    if (!flyer || flyer.status !== "published" || !isRealFlyerTitle(flyer.title) || !flyerSlugLooksUntitled(flyer.public_slug)) return;
    const slug = slugFromFlyerTitle(flyer.title, flyer.public_slug);
    setFlyer({ public_slug: slug });
    void supabase.from("flyers").update({ public_slug: slug }).eq("id", flyer.id);
  }, [flyer, setFlyer]);

  function openCategory() {
    setEditCategory(((flyer as any)?.category as FlyerCategory) || "business");
    setEditEventDate((flyer as any)?.event_date ? new Date(((flyer as any).event_date as string) + "T00:00:00") : undefined);
    setCategoryOpen(true);
  }

  function updateTitle(title: string) {
    if (flyer.status === "published" && isRealFlyerTitle(title)) {
      setFlyer({ title, public_slug: slugFromFlyerTitle(title, flyer.public_slug) });
      return;
    }
    setFlyer({ title });
  }

  async function saveCategory() {
    if (!flyer) return;
    if (editCategory === "event" && !editEventDate) {
      toast.error("Please pick the event date");
      return;
    }
    setSavingCategory(true);
    const eventDateStr = editCategory === "event" && editEventDate ? format(editEventDate, "yyyy-MM-dd") : null;
    const { error } = await supabase
      .from("flyers")
      .update({ category: editCategory, event_date: eventDateStr } as any)
      .eq("id", flyer.id);
    setSavingCategory(false);
    if (error) { toast.error(error.message); return; }
    setFlyer({ ...(flyer as any), category: editCategory, event_date: eventDateStr } as any);
    setCategoryOpen(false);
    toast.success("Category updated");
  }

  if (!flyer) return null;

  async function ensureThumbnail(force = false) {
    if (!flyer) return;
    if (!force && flyer.thumbnail_url) return;
    setRegenerating(true);
    try {
      const store = useEditorStore.getState();
      // Prefer a landing page (one with a tap-anywhere link) so the share
      // preview matches the link recipients open first. Fall back to page 1.
      const landingPage = store.pages.find((p) => p.background?.linkPageId);
      const sourcePage = landingPage ?? store.pages[0];
      if (!sourcePage) return;
      if (store.selectedPageId !== sourcePage.id) {
        store.selectPage(sourcePage.id);
        await new Promise((r) => setTimeout(r, 300));
      } else {
        await new Promise((r) => setTimeout(r, 80));
      }
      const stage = useEditorStore.getState().stageRef;
      if (!stage) {
        toast.error("Couldn't capture the page. Try again.");
        return;
      }
      const captureW = sourcePage.background?.size?.width ?? flyer.settings.width;
      const captureH = sourcePage.background?.size?.height ?? flyer.settings.height;
      try {
        const url = await generateAndUploadThumbnail(
          stage,
          flyer.id,
          captureW,
          captureH,
          sourcePage.background?.color || flyer.settings.background || "#ffffff"
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
    // Always regenerate so any old letterboxed/padded preview gets replaced
    // with a flyer-only image at the flyer's native aspect ratio.
    void ensureThumbnail(true);
  }

  async function togglePublish() {
    if (!flyer) return;
    const newStatus = flyer.status === "published" ? "draft" : "published";
    let slug = flyer.public_slug;
    const titleNow = (flyer.title || "").trim();
    const titleIsReal = isRealFlyerTitle(titleNow);
    const looksStale = !slug || (flyerSlugLooksUntitled(slug) && titleIsReal);
    if (newStatus === "published" && looksStale) {
      slug = slugFromFlyerTitle(titleIsReal ? titleNow : "flyer", slug);
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
    "https://tapthatflyer-share.showoffgrafixs.workers.dev";
  const socialUrl =
    shareOrigin && flyer.public_slug
      ? `${shareOrigin.replace(/\/$/, "")}/f/${flyer.public_slug}`
      : viewerUrl;

  // If any page is configured as a "tap-anywhere" link (typically a landing
  // page that points into the flyer), expose a second share link that opens
  // the linked target page directly via ?page=<id>.
  const landingPage = pagesForLinks.find((p) => p.background?.linkPageId);
  const directExtraLinks =
    landingPage && socialUrl
      ? [
          {
            label: "Direct to flyer (skips landing)",
            url: `${socialUrl}${socialUrl.includes("?") ? "&" : "?"}page=${landingPage.background!.linkPageId}`,
            description: "No landing page intro",
          },
        ]
      : undefined;

  return (
    <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2">
      <Button asChild variant="ghost" size="sm">
        <Link to="/dashboard"><ChevronLeft className="mr-1 h-4 w-4" />Dashboard</Link>
      </Button>
      <Input
        className="h-8 max-w-xs border-transparent bg-transparent font-semibold focus-visible:border-input"
        value={flyer.title}
        onChange={(e) => updateTitle(e.target.value)}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={(flyer as any).category === "event" ? "default" : "outline"}
              onClick={openCategory}
            >
              {(flyer as any).category === "event" ? <PartyPopper className="mr-1 h-4 w-4" /> : <Briefcase className="mr-1 h-4 w-4" />}
              {(flyer as any).category === "event"
                ? ((flyer as any).event_date ? format(new Date(((flyer as any).event_date as string) + "T00:00:00"), "MMM d") : "Event")
                : "Business"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {(flyer as any).category === "event"
              ? "Event flyer — auto-unpublishes the day after the event"
              : "Business flyer — stays published until you unpublish"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => setSubscribersOpen(true)}>
              <Users className="mr-1 h-4 w-4" /> Subscribers
            </Button>
          </TooltipTrigger>
          <TooltipContent>View subscribers, export to Excel, mass email</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="sm" variant="outline">
              <Link to={`/flyer/${flyer.id}/portal`}>
                <Inbox className="mr-1 h-4 w-4" /> Portal
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Appointments, subscribers, form submissions</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => setPortalLinkOpen(true)}>
              <LinkIcon className="mr-1 h-4 w-4" /> Portal link
            </Button>
          </TooltipTrigger>
          <TooltipContent>Get a private link + access code to share this flyer's portal</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="sm" variant="outline">
              <Link to={`/analytics/${flyer.id}`}>
                <BarChart3 className="mr-1 h-4 w-4" /> Results
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View live poll results</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="sm" variant="outline">
              <a href={`/preview/${flyer.id}`} target="_blank" rel="noreferrer">
                <Eye className="mr-1 h-4 w-4" />Preview <span className="ml-1 hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">(private)</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Only you can see this. To send it to others, use <strong>Share</strong> after publishing.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={flyer.settings.introAudioUrl ? "default" : "outline"}
              onClick={() => setIntroAudioOpen(true)}
            >
              <Music className="mr-1 h-4 w-4" /> Intro audio
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {flyer.settings.introAudioUrl
              ? "Intro audio set — click to edit"
              : "Play an audio clip when viewers first open the flyer"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={(flyer.settings.payVenmo || flyer.settings.payCashapp || flyer.settings.payApplePayContact) ? "default" : "outline"}
              onClick={() => setPaySettingsOpen(true)}
            >
              <Wallet className="mr-1 h-4 w-4" /> Checkout
            </Button>
          </TooltipTrigger>
          <TooltipContent>Set Venmo / Cash App / Apple Cash for cart checkout</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
              <DollarSign className="mr-1 h-4 w-4" /> Pay link
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate a one-off Venmo / Cash App / PayPal link to send to customers</TooltipContent>
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

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Flyer category</DialogTitle>
            <DialogDescription>Events automatically unpublish the day after the event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditCategory("business")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition",
                  editCategory === "business" ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border hover:border-primary/40"
                )}
              >
                <Briefcase className="h-5 w-5 text-primary" />
                <div className="font-semibold">Business</div>
                <div className="text-xs text-muted-foreground">Stays published until you unpublish.</div>
              </button>
              <button
                type="button"
                onClick={() => setEditCategory("event")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition",
                  editCategory === "event" ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border hover:border-primary/40"
                )}
              >
                <PartyPopper className="h-5 w-5 text-primary" />
                <div className="font-semibold">Event</div>
                <div className="text-xs text-muted-foreground">Auto-unpublishes the day after.</div>
              </button>
            </div>
            {editCategory === "event" && (
              <div className="space-y-2">
                <Label>Event date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editEventDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editEventDate ? format(editEventDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editEventDate}
                      onSelect={setEditEventDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCategoryOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory} disabled={savingCategory}>
              {savingCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
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
        isPublished={flyer.status === "published" && !!flyer.public_slug}
        extraLinks={directExtraLinks}
      />

      <PaymentLinkDialog open={payOpen} onOpenChange={setPayOpen} />
      <FlyerPaymentSettingsDialog open={paySettingsOpen} onOpenChange={setPaySettingsOpen} />
      <PortalLinkDialog flyerId={flyer.id} open={portalLinkOpen} onOpenChange={setPortalLinkOpen} />
      <IntroAudioDialog open={introAudioOpen} onOpenChange={setIntroAudioOpen} />
      <SubscribersPanel
        open={subscribersOpen}
        onOpenChange={setSubscribersOpen}
        flyerId={flyer.id}
        flyerTitle={flyer.title}
        flyerUrl={viewerUrl}
      />
    </header>
  );
}
