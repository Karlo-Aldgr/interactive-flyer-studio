import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useEditorStore, ResizeMode } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, Undo2, Redo2, Globe, Loader2, ZoomIn, ZoomOut, Crop, Share2, Sparkles,
  Briefcase, PartyPopper, CalendarIcon, LayoutDashboard, PenTool, Save,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { buildPublicBizadUrl, buildPublicFlyerUrl, buildSocialLandingShareUrl, buildSocialShareUrl, cn, flyerSlugLooksUntitled, isRealFlyerTitle, slugFromFlyerTitle } from "@/lib/utils";
import { getBizadForFlyer } from "@/lib/bizad";
import type { FlyerCategory } from "@/types/flyer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateAndUploadThumbnail, uploadManualThumbnail, stageToSocialDataURL, uploadFlyerVariantFromDataUrl, uploadLandingVariantFromDataUrl } from "@/lib/thumbnail";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareDialog } from "./ShareDialog";
import { AutomationHubDialog } from "./AutomationHubDialog";
import { MarketingCoachDialog } from "./MarketingCoachDialog";
import { AutoPilotDialog } from "./AutoPilotDialog";
import { FacebookPostDialog } from "./FacebookPostDialog";
import { InstagramPostDialog } from "./InstagramPostDialog";
import { MarketingDraftsDialog } from "./MarketingDraftsDialog";
import { triggerMarketingOnPublish } from "@/lib/marketingAutomation";
import { PaymentLinkDialog } from "./PaymentLinkDialog";
import { FlyerPaymentSettingsDialog } from "./FlyerPaymentSettingsDialog";
import { IntroAudioDialog } from "./IntroAudioDialog";
import { BackgroundAudioDialog } from "./BackgroundAudioDialog";
import { SubscribersPanel } from "./SubscribersPanel";
import { PortalLinkDialog } from "./PortalLinkDialog";
import { BizadDialog } from "./BizadDialog";
import { SocialMediaDialog } from "./SocialMediaDialog";
import {
  TopBarFlyerMenu, TopBarMediaMenu, TopBarMobileMenu, TopBarPaymentsMenu,
  TopBarPortalMenu, TopBarPreviewButton, TopBarViewMenu, type TopBarMenuActions,
} from "./TopBarActionMenus";

interface Props { saving: boolean; onSave?: () => void | Promise<void> }

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Story 9:16 (1080×1920)", w: 1080, h: 1920 },
  { label: "Portrait 4:5 (1080×1350)", w: 1080, h: 1350 },
  { label: "Square 1:1 (1080×1080)", w: 1080, h: 1080 },
  { label: "Landscape 16:9 (1920×1080)", w: 1920, h: 1080 },
  { label: "A4 Portrait (2480×3508)", w: 2480, h: 3508 },
  { label: "Default (900×1200)", w: 900, h: 1200 },
];

export function TopBar({ saving, onSave }: Props) {
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
  const setPageSize = useEditorStore((s) => s.setPageSize);
  const startCrop = useEditorStore((s) => s.startCrop);
  const pagesForLinks = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);

  const activePage = pagesForLinks.find((p) => p.id === selectedPageId) ?? pagesForLinks[0];
  const activePageHasOwnSize = !!activePage?.background?.size;
  const activeWidth = activePage?.background?.size?.width ?? flyer?.settings.width ?? 1080;
  const activeHeight = activePage?.background?.size?.height ?? flyer?.settings.height ?? 1920;

  const [resizeOpen, setResizeOpen] = useState(false);
  const [presetIdx, setPresetIdx] = useState<string>("0");
  const [customW, setCustomW] = useState(1080);
  const [customH, setCustomH] = useState(1920);
  const [useCustom, setUseCustom] = useState(false);
  const [mode, setMode] = useState<ResizeMode>("resize");
  const [shareOpen, setShareOpen] = useState(false);

  const [automationOpen, setAutomationOpen] = useState(false);
  const [autoPilotOpen, setAutoPilotOpen] = useState(false);
  const [facebookPostOpen, setFacebookPostOpen] = useState(false);
  const [instagramPostOpen, setInstagramPostOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [localThumbnail, setLocalThumbnail] = useState<string | undefined>(undefined);
  const [flyerPreviewThumb, setFlyerPreviewThumb] = useState<string | undefined>(undefined);
  const [payOpen, setPayOpen] = useState(false);
  const [introAudioOpen, setIntroAudioOpen] = useState(false);
  const [bgAudioOpen, setBgAudioOpen] = useState(false);
  const [subscribersOpen, setSubscribersOpen] = useState(false);
  const [paySettingsOpen, setPaySettingsOpen] = useState(false);
  const [portalLinkOpen, setPortalLinkOpen] = useState(false);
  const [bizadOpen, setBizadOpen] = useState(false);
  const [bizadShareUrl, setBizadShareUrl] = useState<string | null>(null);

  const [socialOpen, setSocialOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [autoAdvanceOpen, setAutoAdvanceOpen] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const dirty = useEditorStore((s) => s.dirty);
  const [editCategory, setEditCategory] = useState<FlyerCategory>(((flyer as any)?.category as FlyerCategory) || "business");
  const [editEventDate, setEditEventDate] = useState<Date | undefined>(
    (flyer as any)?.event_date ? new Date(((flyer as any).event_date as string) + "T00:00:00") : undefined
  );

  useEffect(() => {
    if (!flyer || flyer.status !== "published" || !isRealFlyerTitle(flyer.title) || !flyerSlugLooksUntitled(flyer.public_slug)) return;
    const slug = slugFromFlyerTitle(flyer.title, flyer.public_slug);
    setFlyer({ public_slug: slug });
    void supabase.from("flyers").update({ public_slug: slug }).eq("id", flyer.id);
  }, [flyer, setFlyer]);

  // Digital business card link for the share dialog.
  useEffect(() => {
    if (!shareOpen || !flyer?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const bizad = await getBizadForFlyer(flyer.id);
        if (!cancelled) {
          setBizadShareUrl(bizad?.slug && bizad.enabled ? buildPublicBizadUrl(bizad.slug) : null);
        }
      } catch {
        if (!cancelled) setBizadShareUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [shareOpen, flyer?.id]);


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
    if (!force && flyer.thumbnail_url && flyerPreviewThumb) return;
    setRegenerating(true);
    try {
      const store = useEditorStore.getState();
      // Prefer a landing page (one with a tap-anywhere link) so the share
      // preview matches the link recipients open first. Fall back to page 1.
      const landingPage = store.pages.find((p) => p.background?.linkPageId);
      const sourcePage = landingPage ?? store.pages[0];
      if (!sourcePage) return;
      // Capture the LANDING page first (this also uploads → social thumbnail).
      if (store.selectedPageId !== sourcePage.id) {
        store.selectPage(sourcePage.id);
        await new Promise((r) => setTimeout(r, 300));
      } else {
        await new Promise((r) => setTimeout(r, 80));
      }
      let stage = useEditorStore.getState().stageRef;
      if (!stage) {
        toast.error("Couldn't capture the page. Try again.");
        return;
      }
      const captureW = sourcePage.background?.size?.width ?? flyer.settings.width;
      const captureH = sourcePage.background?.size?.height ?? flyer.settings.height;
      try {
        const bg = sourcePage.background?.color || flyer.settings.background || "#ffffff";
        let url: string;
        try {
          url = await generateAndUploadThumbnail(stage, flyer.id, captureW, captureH, bg);
        } catch (firstErr) {
          console.warn("[ensureThumbnail] upload failed, retrying once…", firstErr);
          await new Promise((r) => setTimeout(r, 500));
          url = await generateAndUploadThumbnail(stage, flyer.id, captureW, captureH, bg);
        }
        setLocalThumbnail(url);
        const cleanUrl = url.split("?")[0];
        setFlyer({ thumbnail_url: cleanUrl });
        // If this source page is a landing page, also upload it under the
        // per-page variant path so the share Worker can serve it for
        // ?page=<id> share links.
        if (landingPage) {
          try {
            const landingData = stageToSocialDataURL(
              stage,
              captureW,
              captureH,
              sourcePage.background?.color || flyer.settings.background || "#ffffff"
            );
            if (landingData) {
              await uploadLandingVariantFromDataUrl(
                landingData, flyer.id, sourcePage.id, captureW, captureH,
                sourcePage.background?.color || flyer.settings.background || "#000000"
              );
            }
          } catch (e) {
            console.warn("[landing variant upload] failed", e);
          }
        }
        if (force) toast.success("Social preview updated");
      } catch (e: any) {
        console.error("[ensureThumbnail]", e);
        toast.error(e?.message || "Could not generate preview");
      }

      // Capture the FLYER target page locally (no upload — preview only).
      const linkedId = sourcePage.background?.linkPageId;
      const flyerPage = linkedId
        ? store.pages.find((p) => p.id === linkedId)
        : store.pages.find((p) => p.id !== sourcePage.id);
      if (flyerPage) {
        store.selectPage(flyerPage.id);
        await new Promise((r) => setTimeout(r, 500));
        stage = useEditorStore.getState().stageRef;
        if (stage) {
          // Wait for all Konva.Image nodes on the stage to have loaded their
          // underlying HTMLImageElements — otherwise the capture will be a
          // blank/white frame on first open of the share dialog.
          try {
            const imgNodes: any[] = stage.find("Image") || [];
            await Promise.all(
              imgNodes.map((n: any) => {
                const img = n.image && n.image();
                if (!img) return Promise.resolve();
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise<void>((resolve) => {
                  const done = () => resolve();
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                  setTimeout(done, 1500);
                });
              })
            );
            stage.batchDraw();
            await new Promise((r) => setTimeout(r, 100));
          } catch (e) {
            console.warn("[flyer preview wait] failed", e);
          }
          try {
            const fW = flyerPage.background?.size?.width ?? flyer.settings.width;
            const fH = flyerPage.background?.size?.height ?? flyer.settings.height;
            const data = stageToSocialDataURL(
              stage,
              fW,
              fH,
              flyerPage.background?.color || flyer.settings.background || "#ffffff"
            );
            if (data) {
              setFlyerPreviewThumb(data);
              // Upload as the "flyer-only" variant so the share Worker can serve
              // it for direct-flyer links (no ?page= param) instead of the
              // landing-page thumbnail.
              try {
                await uploadFlyerVariantFromDataUrl(data, flyer.id, fW, fH, flyerPage.background?.color || flyer.settings.background || "#000000");
              } catch (e) {
                console.warn("[flyer variant upload] failed", e);
              }
            }
          } catch (e) {
            console.warn("[flyer preview capture] failed", e);
          }
        }
        // Restore landing as the active page so the editor view doesn't jump.
        store.selectPage(sourcePage.id);
      } else {
        // No separate flyer page → show the same image in both slots.
        setFlyerPreviewThumb(undefined);
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

  const isWebsitePage = !!activePage?.background?.websitePage;
  const websitePublished = (flyer as any)?.website_status === "published";
  const [publishingWebsite, setPublishingWebsite] = useState(false);

  /** Publishes/unpublishes THIS project's Website page (independent of the flyer). */
  async function toggleWebsitePublish() {
    if (!flyer) return;
    setPublishingWebsite(true);
    try {
      const next = websitePublished ? "draft" : "published";
      let slug = (flyer as any).website_slug as string | null;
      if (next === "published" && !slug) {
        const base = isRealFlyerTitle(flyer.title) ? flyer.title : "website";
        slug = slugFromFlyerTitle(base, null);
      }
      const { error } = await supabase
        .from("flyers")
        .update({ website_status: next, website_slug: slug } as any)
        .eq("id", flyer.id);
      if (error) { toast.error(error.message); return; }
      setFlyer({ website_status: next, website_slug: slug } as any);
      if (next === "published" && slug) {
        toast.success(`Website published at ${window.location.origin}/site/${slug}`);
      } else {
        toast.success("Website unpublished");
      }
    } finally {
      setPublishingWebsite(false);
    }
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

    // On publish, capture a fresh social thumbnail (prefer landing page).
    if (newStatus === "published") {
      let thumbnailForMarketing = localThumbnail ?? flyer.thumbnail_url ?? null;
      const store = useEditorStore.getState();
      const landingPage = store.pages.find((p) => p.background?.linkPageId);
      const sourcePage = landingPage ?? store.pages[0];
      if (sourcePage) {
        if (store.selectedPageId !== sourcePage.id) {
          store.selectPage(sourcePage.id);
          await new Promise((r) => setTimeout(r, 250));
        } else {
          await new Promise((r) => setTimeout(r, 50));
        }
        const stage = useEditorStore.getState().stageRef;
        if (stage) {
          try {
            const captureW = sourcePage.background?.size?.width ?? flyer.settings.width;
            const captureH = sourcePage.background?.size?.height ?? flyer.settings.height;
            const bg = sourcePage.background?.color || flyer.settings.background || "#ffffff";
            const uploaded = await generateAndUploadThumbnail(stage, flyer.id, captureW, captureH, bg);
            if (uploaded) thumbnailForMarketing = uploaded.split("?")[0];
            if (landingPage) {
              try {
                const landingData = stageToSocialDataURL(stage, captureW, captureH, bg);
                if (landingData) {
                  await uploadLandingVariantFromDataUrl(
                    landingData, flyer.id, sourcePage.id, captureW, captureH, bg
                  );
                }
              } catch (e) {
                console.warn("[publish] landing variant upload failed", e);
              }
            }
          } catch (e) {
            console.warn("[publish] thumbnail capture failed", e);
          }
        }
      }

      if (slug) {
        const landingForMarketing = useEditorStore
          .getState()
          .pages.find((p) => p.background?.linkPageId);
        void triggerMarketingOnPublish({
          flyerId: flyer.id,
          ownerId: flyer.owner_id,
          title: titleIsReal ? titleNow : flyer.title,
          slug,
          thumbnailUrl: thumbnailForMarketing,
          landingPageId: landingForMarketing?.id ?? null,
          openPageId: landingForMarketing?.background?.linkPageId ?? null,
        });
      }
    }
  }

  /**
   * Pages that carry their own size (digital business card, landing/menu pages)
   * must be resized page-by-page — the flyer-level setting does not affect them.
   */
  function applySize(w: number, h: number, resizeMode: ResizeMode) {
    if (activePage && activePageHasOwnSize) setPageSize(activePage.id, w, h, resizeMode);
    else setCanvasSize(w, h, resizeMode);
  }

  function applyResize() {
    if (mode === "fit") {
      const allPages = useEditorStore.getState().pages;
      // A page with its own canvas size fits to its own images only.
      const pages = activePage && activePageHasOwnSize ? [activePage] : allPages;
      let best: { w: number; h: number; area: number } | null = null;
      for (const p of pages) {
        for (const l of p.layers) {
          if (l.type !== "image") continue;
          const w = Math.round(l.size.width);
          const h = Math.round(l.size.height);
          const area = w * h;
          if (!best || area > best.area) best = { w, h, area };
        }
      }
      if (!best) {
        toast.error("No image layers found to fit to.");
        return;
      }
      applySize(best.w, best.h, "resize");
      toast.success(`Canvas fit to largest image: ${best.w} × ${best.h}`);
      setResizeOpen(false);
      return;
    }
    const target = useCustom
      ? { w: Math.max(100, customW), h: Math.max(100, customH) }
      : { w: PRESETS[Number(presetIdx)].w, h: PRESETS[Number(presetIdx)].h };
    if (mode === "crop") {
      startCrop({ width: target.w, height: target.h });
      toast.message("Drag the crop area on the canvas, then confirm.");
    } else {
      applySize(target.w, target.h, mode);
      toast.success(`Canvas resized to ${target.w} × ${target.h}`);
    }
    setResizeOpen(false);
  }

  const viewerUrl = flyer.public_slug ? buildPublicFlyerUrl(flyer.public_slug) : "";
  const directShareUrl = flyer.public_slug ? buildSocialShareUrl(flyer.public_slug) : "";

  // If any page is configured as a tap-anywhere landing page, build a second
  // share link that opens the landing itself (?page=<landingId>). Crawlers use
  // the landing thumbnail; humans skip to the flyer via ?open=<flyerPageId>.
  const landingPage = pagesForLinks.find((p) => p.background?.linkPageId);
  const landingShareUrl =
    landingPage && directShareUrl
      ? buildSocialLandingShareUrl(
          flyer.public_slug!,
          landingPage.id,
          landingPage.background?.linkPageId,
        )
      : "";
  const flyerPreviewSection = landingPage
    ? {
        label: "Direct flyer link",
        description: "Skips the landing — opens the flyer.",
        thumbnailUrl: flyerPreviewThumb,
        url: directShareUrl,
      }
    : undefined;

  const menuActions: TopBarMenuActions = {
    flyer,
    flyerId: flyer.id,
    showHitboxes,
    deviceFrame,
    onToggleHitboxes: toggleHitboxes,
    onSetDeviceFrame: setDeviceFrame,
    onToggleHighlights: () =>
      setFlyer({
        settings: {
          ...flyer.settings,
          highlightsEnabled: !(flyer.settings.highlightsEnabled ?? true),
        },
      }),
    onOpenCategory: openCategory,
    onOpenSubscribers: () => setSubscribersOpen(true),
    onOpenPortalLink: () => setPortalLinkOpen(true),
    onOpenBizad: () => setBizadOpen(true),
    onOpenIntroAudio: () => setIntroAudioOpen(true),
    onOpenBgAudio: () => setBgAudioOpen(true),
    onOpenAutoAdvance: () => setAutoAdvanceOpen(true),
    onOpenSocial: () => setSocialOpen(true),
    onOpenCheckout: () => setPaySettingsOpen(true),
    onOpenPayLink: () => setPayOpen(true),
    onOpenShare: openShare,
    onOpenMarketing: () => setAutomationOpen(true),
    onOpenResize: () => { if (!activePage?.background?.websitePage) setResizeOpen(true); },
  };

  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:px-3">
      {/* Navigation + document */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1 rounded-full border-transparent bg-accent px-3 text-accent-foreground hover:bg-accent/90 data-[state=open]:bg-accent/90"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem asChild>
            <Link to="/dashboard" className="flex cursor-pointer items-center">
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard?studio=1" className="flex cursor-pointer items-center">
              <PenTool className="mr-2 h-4 w-4" /> Editor&apos;s Studio
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        className="h-8 min-w-0 flex-1 max-w-[8rem] border-transparent bg-transparent font-semibold focus-visible:border-input sm:max-w-[12rem] lg:max-w-xs"
        value={flyer.title}
        onChange={(e) => updateTitle(e.target.value)}
      />

      {/* Edit */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} disabled={!past} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} disabled={!future} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="hidden h-6 w-px bg-border sm:block" />

      {/* Zoom */}
      <div className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(zoom - 0.1)} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(zoom + 0.1)} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Canvas size — hidden for Website pages (they use the responsive viewport presets) */}
      {!activePage?.background?.websitePage && (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="hidden h-8 shrink-0 px-2 md:inline-flex"
            onClick={() => setResizeOpen(true)}
          >
            <Crop className="mr-1 h-3.5 w-3.5" />
            <span className="tabular-nums">{activeWidth}×{activeHeight}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Change canvas size or crop</TooltipContent>
      </Tooltip>
      )}

      {/* View menu — desktop/tablet */}
      <div className="hidden md:block">
        <TopBarViewMenu {...menuActions} />
      </div>

      <div className="flex-1" />

      {/* Save status */}
      <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">
        {saving ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        ) : dirty ? (
          <span className="text-amber-600">Unsaved changes</span>
        ) : (
          "Saved"
        )}
      </span>

      {onSave && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={dirty ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => onSave()}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Save</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save all changes</TooltipContent>
        </Tooltip>
      )}

      {/* Primary actions — always visible */}
      <div className="lg:hidden">
        <TopBarPreviewButton flyerId={flyer.id} compact hasWebsite={hasWebsitePage} />
      </div>
      <div className="hidden lg:block">
        <TopBarPreviewButton flyerId={flyer.id} hasWebsite={hasWebsitePage} />
      </div>

      {flyer.status === "published" && (
        <>
          <Button size="sm" variant="outline" className="hidden h-8 lg:inline-flex" onClick={openShare}>
            <Share2 className="mr-1 h-4 w-4" /> Share
          </Button>
          <Button size="sm" variant="outline" className="hidden h-8 lg:inline-flex" onClick={() => setAutomationOpen(true)}>
            <Sparkles className="mr-1 h-4 w-4" /> Add automations
          </Button>
        </>
      )}

      <Button
        size="sm"
        disabled={publishingWebsite}
        onClick={isWebsitePage ? toggleWebsitePublish : togglePublish}
        className={cn(
          "h-8 shrink-0 px-3",
          (isWebsitePage ? websitePublished : flyer.status === "published") ? "" : "shadow-glow"
        )}
        title={isWebsitePage ? "Publish this project's Website" : "Publish this flyer"}
      >
        <Globe className="mr-1 h-4 w-4 hidden sm:inline" />
        <span className="hidden sm:inline">
          {isWebsitePage
            ? websitePublished ? "Unpublish website" : "Publish website"
            : flyer.status === "published" ? "Unpublish" : "Publish"}
        </span>
        <Globe className="h-4 w-4 sm:hidden" />
      </Button>

      {/* Grouped menus — large screens */}
      <div className="hidden items-center gap-1 lg:flex">
        <TopBarPortalMenu {...menuActions} />
        <TopBarMediaMenu {...menuActions} />
        <TopBarPaymentsMenu {...menuActions} />
        <TopBarFlyerMenu {...menuActions} />
      </div>

      {/* Overflow — small / medium screens */}
      <div className="lg:hidden">
        <TopBarMobileMenu {...menuActions} />
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
                  <SelectItem value="fit">Fit to media size (use largest image)</SelectItem>
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

      <AutomationHubDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        flyer={flyer}
        onOpenMarketing={() => setMarketingOpen(true)}
        onOpenAutoPilot={() => setAutoPilotOpen(true)}
        onOpenCoach={() => setCoachOpen(true)}
        onOpenFacebookPost={() => setFacebookPostOpen(true)}
        onOpenInstagramPost={() => setInstagramPostOpen(true)}
      />

      <MarketingCoachDialog
        open={coachOpen}
        onOpenChange={setCoachOpen}
        flyerId={flyer.id}
        flyerTitle={flyer.title}
      />

      <AutoPilotDialog
        open={autoPilotOpen}
        onOpenChange={setAutoPilotOpen}
        flyerId={flyer.id}
        ownerId={flyer.owner_id}
        flyerTitle={flyer.title}
        publicSlug={flyer.public_slug}
        onOpenMarketing={() => setMarketingOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        portalPath={`/flyer/${flyer.id}/portal`}
      />

      <FacebookPostDialog
        open={facebookPostOpen}
        onOpenChange={setFacebookPostOpen}
        flyerId={flyer.id}
        ownerId={flyer.owner_id}
        flyerTitle={flyer.title}
        onOpenMarketing={() => setMarketingOpen(true)}
      />

      <InstagramPostDialog
        open={instagramPostOpen}
        onOpenChange={setInstagramPostOpen}
        flyerId={flyer.id}
        flyerTitle={flyer.title}
        onOpenMarketing={() => setMarketingOpen(true)}
        onOpenFacebookPost={() => setFacebookPostOpen(true)}
      />

      <MarketingDraftsDialog
        open={marketingOpen}
        onOpenChange={setMarketingOpen}
        flyerId={flyer.id}
        ownerId={flyer.owner_id}
        flyerTitle={flyer.title}
      />

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        displayUrl={landingShareUrl || directShareUrl}
        socialUrl={directShareUrl}
        title={flyer.title}
        thumbnailUrl={localThumbnail ?? flyer.thumbnail_url ?? undefined}
        onRegenerateThumbnail={() => ensureThumbnail(true)}
        onUploadThumbnail={uploadSocialPreview}
        regenerating={regenerating}
        isPublished={flyer.status === "published" && !!flyer.public_slug}
        flyerPreview={flyerPreviewSection}
        extraLinks={
          bizadShareUrl
            ? [{
                label: "Digital business card",
                url: bizadShareUrl,
                description: "Opens your tappable business card.",
              }]
            : undefined
        }

        landingPreviewMeta={{
          label: "Landing page link",
          description: "Opens the landing page first.",
        }}
      />

      <PaymentLinkDialog open={payOpen} onOpenChange={setPayOpen} />
      <FlyerPaymentSettingsDialog open={paySettingsOpen} onOpenChange={setPaySettingsOpen} />
      <PortalLinkDialog flyerId={flyer.id} open={portalLinkOpen} onOpenChange={setPortalLinkOpen} />
      <BizadDialog flyer={flyer} open={bizadOpen} onOpenChange={setBizadOpen} />
      <IntroAudioDialog open={introAudioOpen} onOpenChange={setIntroAudioOpen} />
      <BackgroundAudioDialog open={bgAudioOpen} onOpenChange={setBgAudioOpen} />
      <SocialMediaDialog open={socialOpen} onOpenChange={setSocialOpen} />
      <SubscribersPanel
        open={subscribersOpen}
        onOpenChange={setSubscribersOpen}
        flyerId={flyer.id}
        flyerTitle={flyer.title}
        flyerUrl={viewerUrl}
      />

      <Dialog open={autoAdvanceOpen} onOpenChange={setAutoAdvanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-advance pages</DialogTitle>
            <DialogDescription>
              Automatically flip to the next page on a timer. Pauses while any popup, video, or form is open.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm font-medium">Enable auto-advance</Label>
                <p className="text-xs text-muted-foreground">Cycles pages on the live flyer.</p>
              </div>
              <Switch
                checked={(flyer.settings as any)?.autoAdvanceEnabled ?? false}
                onCheckedChange={(v) =>
                  setFlyer({ settings: { ...flyer.settings, autoAdvanceEnabled: v } as any })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Interval (milliseconds)</Label>
              <Input
                type="number"
                min={100}
                step={100}
                value={(flyer.settings as any)?.autoAdvanceMs ?? 5000}
                onChange={(e) =>
                  setFlyer({
                    settings: {
                      ...flyer.settings,
                      autoAdvanceMs: Math.max(100, Number(e.target.value) || 0),
                    } as any,
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">1000 ms = 1 second. Minimum 100ms.</p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm font-medium">Loop back to first page</Label>
                <p className="text-xs text-muted-foreground">When the last page is reached, restart from page 1.</p>
              </div>
              <Switch
                checked={(flyer.settings as any)?.autoAdvanceLoop ?? true}
                onCheckedChange={(v) =>
                  setFlyer({ settings: { ...flyer.settings, autoAdvanceLoop: v } as any })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAutoAdvanceOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

