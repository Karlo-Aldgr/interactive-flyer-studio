import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Stage, Layer as KLayer, Rect, Circle, Ellipse, Line, Text, Image as KonvaImage, Group } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import * as LucideIcons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { supabase } from "@/integrations/supabase/client";
import { Flyer, FlyerPage, Layer, LayerAction, AirMessageBubble } from "@/types/flyer";
import { IntroAnimatedGroup, resolveIntro } from "@/components/editor/IntroAnimatedGroup";
import { AirBubble } from "@/components/AirBubble";
import { Loader2, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import { toast } from "sonner";

// Highlight ring shown around tappable layers in the viewer.
function PulseHighlight({ layer, shape }: { layer: Layer; shape: "rect" | "ellipse" }) {
  const ref = useRef<any>(null);
  const cornerRefs = useRef<any[]>([]);
  const hl = layer.action?.highlight ?? {};
  const style = hl.style ?? "pulse";
  const color = hl.color ?? "#7c3aed";
  const thickness = hl.thickness ?? 3;
  const baseOpacity = hl.opacity ?? 0.85;

  useEffect(() => {
    if (style !== "pulse" && style !== "glow") return;
    const node = ref.current;
    if (!node) return;
    const period = 1600;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      const t = (frame.time % period) / period;
      const e = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      if (style === "pulse") {
        node.opacity(baseOpacity * (0.45 + 0.55 * e));
        node.strokeWidth(thickness + 3 * e);
      } else {
        // glow: steady stroke, pulsing shadow
        node.shadowOpacity(0.3 + 0.6 * e);
        node.shadowBlur(8 + 16 * e);
      }
    }, node.getLayer());
    anim.start();
    return () => { anim.stop(); };
  }, [style, thickness, baseOpacity, color]);

  if (style === "corners") {
    // Render 4 L-shaped corner brackets
    const x = layer.position.x;
    const y = layer.position.y;
    const w = layer.size.width;
    const h = layer.size.height;
    const len = Math.max(10, Math.min(w, h) * 0.18);
    const sw = thickness;
    const corners = [
      [[x, y + len], [x, y], [x + len, y]],
      [[x + w - len, y], [x + w, y], [x + w, y + len]],
      [[x, y + h - len], [x, y + h], [x + len, y + h]],
      [[x + w - len, y + h], [x + w, y + h], [x + w, y + h - len]],
    ];
    return (
      <>
        {corners.map((pts, i) => (
          <Line
            key={i}
            points={pts.flat()}
            stroke={color}
            strokeWidth={sw}
            opacity={baseOpacity}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ))}
      </>
    );
  }

  if (style === "circle") {
    // Circular ring around the layer's bounding box
    const cx = layer.position.x + layer.size.width / 2;
    const cy = layer.position.y + layer.size.height / 2;
    const r = Math.max(layer.size.width, layer.size.height) / 2 + thickness * 2;
    return (
      <Circle
        x={cx}
        y={cy}
        radius={r}
        stroke={color}
        strokeWidth={thickness}
        opacity={baseOpacity}
        shadowColor={color}
        shadowBlur={10}
        shadowOpacity={0.4}
        listening={false}
      />
    );
  }

  const dashed = style === "dashed";
  const common = {
    ref,
    x: layer.position.x,
    y: layer.position.y,
    width: layer.size.width,
    height: layer.size.height,
    rotation: layer.rotation,
    stroke: color,
    strokeWidth: thickness,
    opacity: baseOpacity,
    dash: dashed ? [thickness * 3, thickness * 2] : undefined,
    shadowColor: color,
    shadowBlur: style === "glow" ? 16 : style === "pulse" ? 12 : 0,
    shadowOpacity: style === "glow" ? 0.7 : style === "pulse" ? 0.6 : 0,
    listening: false,
    fill: style === "solid" || style === "dashed" ? undefined : `${color}14`,
  } as any;
  if (shape === "ellipse") {
    return (
      <Ellipse
        {...common}
        radiusX={layer.size.width / 2}
        radiusY={layer.size.height / 2}
        offsetX={-layer.size.width / 2}
        offsetY={-layer.size.height / 2}
      />
    );
  }
  return <Rect {...common} cornerRadius={layer.style.cornerRadius || 8} />;
}

function ImageNode({ layer, props }: { layer: Layer; props: any }) {
  const [img] = useImage(layer.content.src ?? "", "anonymous");
  return <KonvaImage {...props} image={img} cornerRadius={layer.style.cornerRadius} />;
}

function IconNode({ layer, props }: { layer: Layer; props: any }) {
  const dataUrl = useMemo(() => {
    const name = layer.content.iconName || "Star";
    const Icon = (LucideIcons as any)[name] || LucideIcons.Star;
    const color = layer.style.color || "#000";
    const svg = renderToStaticMarkup(<Icon size={256} color={color} strokeWidth={2} />);
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }, [layer.content.iconName, layer.style.color]);
  const [img] = useImage(dataUrl);
  return <KonvaImage {...props} image={img} />;
}

function renderLayer(l: Layer, onClick: () => void, hidden: boolean) {
  if (hidden) return null;
  const hasAction = !!l.action;
  const common: any = {
    x: l.position.x,
    y: l.position.y,
    width: l.size.width,
    height: l.size.height,
    rotation: l.rotation,
    opacity: l.style.opacity ?? 1,
    onClick,
    onTap: onClick,
    onMouseEnter: (e: any) => {
      if (hasAction) {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "pointer";
      }
    },
    onMouseLeave: (e: any) => {
      const stage = e.target.getStage();
      if (stage) stage.container().style.cursor = "default";
    },
  };

  switch (l.type) {
    case "text":
      return (
        <Text
          key={l.id}
          {...common}
          text={l.content.text || ""}
          fontFamily={l.style.fontFamily || "Plus Jakarta Sans"}
          fontSize={l.style.fontSize || 24}
          fontStyle={`${l.style.fontStyle === "italic" ? "italic " : ""}${l.style.fontWeight ?? "normal"}`}
          fill={l.style.color || "#000"}
          align={l.style.align || "left"}
        />
      );
    case "image":
      return <ImageNode key={l.id} layer={l} props={common} />;
    case "icon":
      return <IconNode key={l.id} layer={l} props={common} />;
    case "shape":
      if (l.content.shape === "circle") {
        return (
          <Circle
            key={l.id}
            {...common}
            radius={Math.min(l.size.width, l.size.height) / 2}
            offsetX={-l.size.width / 2}
            offsetY={-l.size.height / 2}
            fill={l.style.fill || "#8b5cf6"}
            stroke={l.style.stroke}
            strokeWidth={l.style.strokeWidth}
          />
        );
      }
      if (l.content.shape === "line") {
        return (
          <Line
            key={l.id}
            {...common}
            points={[0, l.size.height / 2, l.size.width, l.size.height / 2]}
            stroke={l.style.fill || "#0f172a"}
            strokeWidth={l.style.strokeWidth || 4}
          />
        );
      }
      return (
        <Rect
          key={l.id}
          {...common}
          fill={l.style.fill || "#8b5cf6"}
          stroke={l.style.stroke}
          strokeWidth={l.style.strokeWidth}
          cornerRadius={l.style.cornerRadius || 0}
        />
      );
    case "button":
      return (
        <Group key={l.id} {...common}>
          <Rect
            width={l.size.width}
            height={l.size.height}
            fill={l.style.fill || "#7c3aed"}
            cornerRadius={l.style.cornerRadius ?? 999}
          />
          <Text
            width={l.size.width}
            height={l.size.height}
            text={l.content.label || "Button"}
            fontFamily={l.style.fontFamily || "Plus Jakarta Sans"}
            fontSize={l.style.fontSize || 16}
            fontStyle={String(l.style.fontWeight ?? "600")}
            fill={l.style.color || "#fff"}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      );
    case "hotspot": {
      // Invisible to viewers — interactive only
      const isEllipse = l.content.hotspotShape === "ellipse";
      if (isEllipse) {
        return (
          <Ellipse
            key={l.id}
            {...common}
            radiusX={l.size.width / 2}
            radiusY={l.size.height / 2}
            offsetX={-l.size.width / 2}
            offsetY={-l.size.height / 2}
            fill="rgba(0,0,0,0.001)"
          />
        );
      }
      return (
        <Rect
          key={l.id}
          {...common}
          fill="rgba(0,0,0,0.001)"
        />
      );
    }
  }
}

interface PublicViewerProps {
  previewMode?: boolean;
}

export default function PublicViewer({ previewMode = false }: PublicViewerProps) {
  const params = useParams();
  const slug = params.slug;
  const flyerId = params.flyerId;
  const [loading, setLoading] = useState(true);
  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [pages, setPages] = useState<FlyerPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [popup, setPopup] = useState<LayerAction | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [formAction, setFormAction] = useState<LayerAction | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [coupon, setCoupon] = useState<LayerAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<LayerAction | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomPopup, setZoomPopup] = useState<LayerAction | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [airMessages, setAirMessages] = useState<{ action: LayerAction; layer: Layer | null } | null>(null);
  const [poll, setPoll] = useState<LayerAction | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const [audioInfo, setAudioInfo] = useState<{ url: string; loop: boolean } | null>(null);
  const introPlayedRef = useRef(false);
  const [introNeedsTap, setIntroNeedsTap] = useState(false);
  const [, setResizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => setResizeTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useEffect(() => {
    if (!slug && !flyerId) return;
    (async () => {
      setLoading(true);
      const query = supabase.from("flyers").select("*");
      const { data: f } = previewMode && flyerId
        ? await query.eq("id", flyerId).maybeSingle()
        : await query.eq("public_slug", slug!).eq("status", "published").maybeSingle();
      if (!f) {
        setLoading(false);
        return;
      }
      const { data: pgs } = await supabase
        .from("pages")
        .select("*, layers(*, actions(*))")
        .eq("flyer_id", f.id)
        .order("index", { ascending: true });

      const mapped: FlyerPage[] = (pgs ?? []).map((p: any) => ({
        id: p.id,
        flyer_id: p.flyer_id,
        index: p.index,
        name: p.name,
        background: p.background ?? { color: "#ffffff" },
        intro: p.intro ?? null,
        layers: (p.layers ?? [])
          .sort((a: any, b: any) => a.z_index - b.z_index)
          .map((l: any) => ({
            id: l.id,
            page_id: l.page_id,
            type: l.type,
            position: l.position,
            size: l.size,
            rotation: Number(l.rotation) || 0,
            z_index: l.z_index,
            style: l.style ?? {},
            content: l.content ?? {},
            intro: l.intro ?? null,
            action: l.actions?.[0]
              ? { id: l.actions[0].id, type: l.actions[0].type, payload: l.actions[0].payload, highlight: l.actions[0].highlight ?? undefined }
              : null,
          })),
      }));
      setFlyer(f as unknown as Flyer);
      setPages(mapped);
      setLoading(false);

      // analytics: view (skip in preview mode)
      if (!previewMode) {
        supabase.from("analytics_events").insert([{ flyer_id: f.id, event_type: "view", metadata: {} } as any]);
      }
    })();
  }, [slug, flyerId, previewMode]);

  function logClick(layer: Layer | null, type: string) {
    if (!flyer || previewMode) return;
    supabase.from("analytics_events").insert([{
      flyer_id: flyer.id,
      page_id: layer?.page_id ?? null,
      layer_id: layer?.id ?? null,
      event_type: "click",
      metadata: { action_type: type } as any,
    } as any]);
  }

  function runAction(layer: Layer) {
    if (!layer.action) return;
    logClick(layer, layer.action.type);
    executeAction(layer.action, layer);
  }

  function executeAction(a: LayerAction, layer: Layer | null) {
    switch (a.type) {
      case "open_url":
        if (a.payload.url) window.open(a.payload.url, a.payload.newTab !== false ? "_blank" : "_self", "noopener,noreferrer");
        break;
      case "popup":
        setPopup(a);
        break;
      case "video":
        if (a.payload.videoUrl) setVideo(a.payload.videoUrl);
        break;
      case "audio": {
        const url = a.payload.audioUrl;
        if (!url) break;
        // Toggle: tapping the same source again stops it
        if (audioRef.current && audioInfo?.url === url && !audioRef.current.paused) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setAudioInfo(null);
          break;
        }
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const el = new Audio(url);
        el.loop = !!a.payload.audioLoop;
        el.onended = () => setAudioInfo((s) => (s?.url === url ? null : s));
        el.play().catch(() => toast.error("Could not play audio"));
        audioRef.current = el;
        setAudioInfo({ url, loop: !!a.payload.audioLoop });
        break;
      }
      case "call":
        if (a.payload.phone) window.location.href = `tel:${a.payload.phone}`;
        break;
      case "sms":
        if (a.payload.phone) {
          const body = a.payload.message ? `?body=${encodeURIComponent(a.payload.message)}` : "";
          window.location.href = `sms:${a.payload.phone}${body}`;
        }
        break;
      case "form":
        setFormAction(a);
        setFormData({});
        break;
      case "navigate": {
        const idx = pages.findIndex((p) => p.id === a.payload.pageId);
        if (idx >= 0) setPageIndex(idx);
        break;
      }
      case "reveal": {
        const next = new Set(revealed);
        (a.payload.targetLayerIds || []).forEach((id) => next.add(id));
        setRevealed(next);
        break;
      }
      case "add_to_calendar":
        runAddToCalendar(a.payload);
        break;
      case "buy_ticket":
        // Show as popup with ticket image + buy button
        setPopup(a);
        break;
      case "buy_product":
        // Show as popup with product details + buy button
        setPopup(a);
        break;
      case "rsvp":
        setFormAction(a);
        setFormData({});
        break;
      case "checkout":
        if (a.payload.title) setConfirmAction(a);
        else if (a.payload.checkoutUrl) window.open(a.payload.checkoutUrl, "_blank", "noopener,noreferrer");
        break;
      case "coupon":
        setCoupon(a);
        break;
      case "air_messages":
        setAirMessages({ action: a, layer: layer ?? null });
        break;
      case "poll":
        setPoll(a);
        break;
      case "map": {
        const { mapAddress, mapLat, mapLng, mapProvider } = a.payload;
        const isApple = (() => {
          if (mapProvider === "apple") return true;
          if (mapProvider === "google") return false;
          return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
        })();
        const hasCoords = typeof mapLat === "number" && typeof mapLng === "number";
        let url = "";
        if (isApple) {
          if (hasCoords) url = `https://maps.apple.com/?ll=${mapLat},${mapLng}${mapAddress ? `&q=${encodeURIComponent(mapAddress)}` : ""}`;
          else if (mapAddress) url = `https://maps.apple.com/?q=${encodeURIComponent(mapAddress)}`;
        } else {
          if (hasCoords) url = `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`;
          else if (mapAddress) url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`;
        }
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        break;
      }
    }
  }

  function runPopupButton(a: LayerAction, closeZoom = false) {
    logClick(null, "popup_button:" + a.type);
    setPopup(null);
    if (closeZoom) {
      setZoomImage(null);
      setZoomPopup(null);
    }
    executeAction(a, null);
  }

  async function submitForm() {
    if (!formAction || !flyer) return;
    const isRsvp = formAction.type === "rsvp";
    const fieldList = (isRsvp ? formAction.payload.rsvpFields : formAction.payload.fields) || [];
    // basic required check
    for (const f of fieldList) {
      if (!formData[f]) {
        toast.error(`Please enter your ${f}`);
        return;
      }
    }
    const { error } = await supabase.from("form_submissions").insert([{
      flyer_id: flyer.id,
      layer_id: null,
      data: { ...formData, _preset: isRsvp ? "rsvp" : "form" } as any,
    }]);
    if (error) {
      toast.error("Could not submit");
      return;
    }
    toast.success(formAction.payload.successMessage || (isRsvp ? "Thanks for your RSVP!" : "Thanks!"));
    const offerCalendar = isRsvp && formAction.payload.rsvpAddToCalendar && formAction.payload.eventTitle && formAction.payload.startISO;
    const calPayload = formAction.payload;
    setFormAction(null);
    if (offerCalendar) {
      setTimeout(() => runAddToCalendar(calPayload), 100);
    }
  }

  // Intro audio: try to autoplay once the flyer loads. If browser blocks autoplay,
  // show a tap prompt and start on the first user interaction.
  useEffect(() => {
    if (!flyer) return;
    const url = flyer.settings?.introAudioUrl;
    if (!url || introPlayedRef.current) return;
    const loop = !!flyer.settings?.introAudioLoop;
    const el = new Audio(url);
    el.loop = loop;
    el.onended = () => setAudioInfo((s) => (s?.url === url ? null : s));
    audioRef.current = el;

    const start = () => {
      if (introPlayedRef.current) return;
      introPlayedRef.current = true;
      el.play()
        .then(() => {
          setAudioInfo({ url, loop });
          setIntroNeedsTap(false);
        })
        .catch(() => {
          // Autoplay blocked — wait for user gesture
          introPlayedRef.current = false;
          setIntroNeedsTap(true);
        });
    };

    start();

    const onTap = () => {
      if (!introPlayedRef.current) start();
      window.removeEventListener("pointerdown", onTap);
      window.removeEventListener("keydown", onTap);
    };
    window.addEventListener("pointerdown", onTap);
    window.addEventListener("keydown", onTap);
    return () => {
      window.removeEventListener("pointerdown", onTap);
      window.removeEventListener("keydown", onTap);
    };
  }, [flyer?.id, flyer?.settings?.introAudioUrl, flyer?.settings?.introAudioLoop]);

  // Auto-trigger any actions on the current page that have payload.autoTrigger === true.
  const autoFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading || !flyer || pages.length === 0) return;
    const page = pages[pageIndex];
    if (!page) return;
    const fired = autoFiredRef.current;
    let i = 0;
    page.layers.forEach((l) => {
      const a = l.action;
      if (!a || !a.payload?.autoTrigger) return;
      const key = `${page.id}:${a.id}`;
      if (fired.has(key)) return;
      fired.add(key);
      setTimeout(() => executeAction(a, l), 350 + i * 250);
      i++;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loading, flyer?.id, pages.length]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!flyer || pages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="font-display text-2xl font-bold">Flyer not found</div>
          <p className="mt-2 text-muted-foreground">This flyer may have been unpublished.</p>
        </div>
      </div>
    );
  }

  const page = pages[pageIndex];
  const W = flyer.settings.width;
  const H = flyer.settings.height;
  // Hide layers initially that are referenced by any reveal action and not yet revealed
  const hiddenIds = new Set<string>();
  pages.forEach((p) =>
    p.layers.forEach((l) => {
      if (l.action?.type === "reveal") {
        (l.action.payload.targetLayerIds || []).forEach((id) => {
          if (!revealed.has(id)) hiddenIds.add(id);
        });
      }
    })
  );

  // Fit-to-screen scale: fill the viewport edge-to-edge (no padding around the flyer).
  const vw = typeof window !== "undefined" ? window.innerWidth : W;
  const vh = typeof window !== "undefined" ? window.innerHeight : H;
  const fitScale = Math.min(vw / W, vh / H);
  // Enlarged: fill the longer viewport edge so user can scroll/pan to inspect details.
  // Multiplier gives extra zoom on top of fit-to-screen.
  const enlargedScale = Math.max(vw / W, vh / H) * 1.6;
  const scale = enlarged ? enlargedScale : fitScale;

  return (
    <div
      className={`flex min-h-screen ${enlarged ? "items-start justify-start" : "items-center justify-center"} overflow-auto`}
      style={{ background: page.background.color || "#fff", touchAction: "pinch-zoom" }}
    >
      {previewMode && (
        <div className="fixed top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs font-medium shadow-elegant backdrop-blur">
          <span>Preview mode</span>
          <span className="text-muted-foreground">·</span>
          <button
            className={`rounded-full px-2 py-0.5 text-[11px] ${showHitboxes ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setShowHitboxes((v) => !v)}
          >
            {showHitboxes ? "Hide hotspots" : "Show hotspots"}
          </button>
        </div>
      )}
      {/* Enlarge / fit toggle — keeps Konva hotspots fully interactive */}
      <button
        type="button"
        aria-label={enlarged ? "Fit to screen" : "Enlarge flyer"}
        onClick={() => setEnlarged((v) => !v)}
        className="fixed top-3 right-3 z-50 inline-flex items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium shadow-elegant backdrop-blur hover:bg-card"
      >
        {enlarged ? (
          <>
            <LucideIcons.Minimize2 className="h-3.5 w-3.5" />
            Fit
          </>
        ) : (
          <>
            <LucideIcons.Maximize2 className="h-3.5 w-3.5" />
            Enlarge
          </>
        )}
      </button>
      <div ref={stageWrapRef} style={{ position: "relative", width: W * scale, height: H * scale, background: page.background.color || "#fff" }}>
        <Stage width={W * scale} height={H * scale} scaleX={scale} scaleY={scale}>
          <KLayer>
            <Rect x={0} y={0} width={W} height={H} fill={page.background.color || "#fff"} listening={false} />
            {(() => {
              const pageCfg = resolveIntro(page.intro);
              const sorted = [...page.layers].sort((a, b) => a.z_index - b.z_index);
              return sorted.map((l, idx) => {
                const node = renderLayer(l, () => runAction(l), hiddenIds.has(l.id));
                if (!node) return null;
                // Per-layer intro overrides the page-level intro entirely.
                const cfg = l.intro ? resolveIntro(l.intro) : pageCfg;
                const cx = l.position.x + l.size.width / 2;
                const cy = l.position.y + l.size.height / 2;
                const delay = l.intro
                  ? cfg.delayMs
                  : cfg.delayMs + (cfg.stagger ? idx * cfg.staggerStepMs : 0);
                return (
                  <IntroAnimatedGroup
                    key={l.id}
                    preset={cfg.preset}
                    durationMs={cfg.durationMs}
                    delayMs={delay}
                    cx={cx}
                    cy={cy}
                    introKey={`${page.id}:${pageIndex}`}
                  >
                    {node}
                  </IntroAnimatedGroup>
                );
              });
            })()}
          </KLayer>
          {/* Pulsing highlights to indicate tappable hotspots */}
          {(flyer.settings?.highlightsEnabled ?? true) && (
            <KLayer listening={false}>
              {page.layers
                .filter((l) => (l.action || l.type === "hotspot") && !hiddenIds.has(l.id))
                .filter((l) => {
                  const h = l.action?.highlight;
                  if (!h) return true; // default: show
                  if (h.enabled === false) return false;
                  if (h.style === "none") return false;
                  return true;
                })
                .map((l) => {
                  const shape: "rect" | "ellipse" =
                    l.type === "hotspot" && l.content.hotspotShape === "ellipse" ? "ellipse" : "rect";
                  return <PulseHighlight key={"pulse-" + l.id} layer={l} shape={shape} />;
                })}
            </KLayer>
          )}
          {previewMode && showHitboxes && (
            <KLayer listening={false}>
              {page.layers
                .filter((l) => (l.action || l.type === "hotspot") && !hiddenIds.has(l.id))
                .map((l) => {
                  const isEllipse = l.type === "hotspot" && l.content.hotspotShape === "ellipse";
                  return isEllipse ? (
                    <Ellipse
                      key={"hb-" + l.id}
                      x={l.position.x + l.size.width / 2}
                      y={l.position.y + l.size.height / 2}
                      radiusX={l.size.width / 2}
                      radiusY={l.size.height / 2}
                      stroke="#7c3aed" strokeWidth={2} dash={[8, 5]}
                      fill="rgba(124,58,237,0.15)"
                    />
                  ) : (
                    <Rect
                      key={"hb-" + l.id}
                      x={l.position.x} y={l.position.y}
                      width={l.size.width} height={l.size.height}
                      stroke="#7c3aed" strokeWidth={2} dash={[8, 5]}
                      fill="rgba(124,58,237,0.15)"
                    />
                  );
                })}
            </KLayer>
          )}
        </Stage>
        {/* Inline air-messages overlay — positioned over the flyer, no backdrop. */}
        {airMessages && (
          <AirMessagesInline
            action={airMessages.action}
            sourceLayer={airMessages.layer}
            scale={scale}
            canvasW={W}
            canvasH={H}
            onClose={() => setAirMessages(null)}
            onRunBubbleAction={(a) => {
              logClick(null, "air_message:" + a.type);
              executeAction(a, null);
            }}
          />
        )}
      </div>

      {/* Pagination */}
      {pages.length > 1 && (
        <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-elegant backdrop-blur">
          <Button variant="ghost" size="sm" disabled={pageIndex === 0} onClick={() => setPageIndex((i) => i - 1)}>Prev</Button>
          <span className="text-xs">{pageIndex + 1} / {pages.length}</span>
          <Button variant="ghost" size="sm" disabled={pageIndex === pages.length - 1} onClick={() => setPageIndex((i) => i + 1)}>Next</Button>
        </div>
      )}

      {/* Popup (also used for buy_ticket) */}
      <Dialog open={!!popup} onOpenChange={(v) => !v && setPopup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{popup?.payload.title || (popup?.type === "buy_ticket" ? "Get your ticket" : popup?.type === "buy_product" ? (popup.payload.productName || "Buy product") : "Info")}</DialogTitle>
            {popup?.payload.body && <DialogDescription>{popup.payload.body}</DialogDescription>}
          </DialogHeader>
          {popup?.type === "buy_ticket" && popup.payload.ticketImageUrl && (
            <div className="relative w-full">
              <img
                src={popup.payload.ticketImageUrl}
                alt="Ticket"
                className="block w-full rounded"
                draggable={false}
              />
              <button
                type="button"
                aria-label="Enlarge image"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomImage(popup.payload.ticketImageUrl!);
                }}
                className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-background/80 backdrop-blur px-2 py-1 text-xs font-medium text-foreground border border-border shadow-sm hover:bg-background transition"
              >
                <LucideIcons.Maximize2 className="h-3.5 w-3.5" />
                Enlarge
              </button>
            </div>
          )}
          {popup?.type === "buy_product" && (
            <div className="space-y-3">
              {popup.payload.productImageUrl && (
                <div className="relative w-full">
                  <img
                    src={popup.payload.productImageUrl}
                    alt={popup.payload.productName || "Product"}
                    className="block w-full rounded object-cover max-h-[60vh]"
                    draggable={false}
                  />
                  <button
                    type="button"
                    aria-label="Enlarge image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomImage(popup.payload.productImageUrl!);
                    }}
                    className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-background/80 backdrop-blur px-2 py-1 text-xs font-medium text-foreground border border-border shadow-sm hover:bg-background transition"
                  >
                    <LucideIcons.Maximize2 className="h-3.5 w-3.5" />
                    Enlarge
                  </button>
                </div>
              )}
              {(popup.payload.productPrice || popup.payload.productCurrency) && (
                <div className="text-2xl font-semibold text-foreground">
                  {popup.payload.productCurrency ? `${popup.payload.productCurrency} ` : ""}
                  {popup.payload.productPrice}
                </div>
              )}
              {popup.payload.productDescription && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {popup.payload.productDescription}
                </p>
              )}
            </div>
          )}
          {popup?.type !== "buy_ticket" && popup?.type !== "buy_product" && popup?.payload.mediaUrl && (() => {
            return (
            <div className="relative w-full">
              <img
                src={popup.payload.mediaUrl}
                alt=""
                className="block w-full rounded"
                draggable={false}
              />
              <button
                type="button"
                aria-label="Enlarge image"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomPopup(popup);
                  setZoomImage(popup.payload.mediaUrl!);
                }}
                className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-background/80 backdrop-blur px-2 py-1 text-xs font-medium text-foreground border border-border shadow-sm hover:bg-background transition"
              >
                <LucideIcons.Maximize2 className="h-3.5 w-3.5" />
                Enlarge
              </button>
              {(popup.payload.hotspots || []).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-label={h.label || "Hotspot"}
                  onClick={(e) => {
                    e.stopPropagation();
                    runPopupButton(h.action);
                  }}
                  className={`absolute border-2 border-primary/70 bg-primary/10 hover:bg-primary/30 transition cursor-pointer ${
                    h.shape === "ellipse" ? "rounded-full" : "rounded-sm"
                  }`}
                  style={{
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`,
                    width: `${h.width * 100}%`,
                    height: `${h.height * 100}%`,
                  }}
                  title={h.label}
                />
              ))}
            </div>
            );
          })()}
          {popup?.type === "buy_ticket" && popup.payload.checkoutUrl && (
            <Button
              className="w-full"
              onClick={() => {
                logClick(null, "buy_ticket_cta");
                window.open(popup.payload.checkoutUrl!, "_blank", "noopener,noreferrer");
              }}
            >
              {popup.payload.ticketCtaLabel || "Buy ticket"}
            </Button>
          )}
          {popup?.type === "buy_product" && popup.payload.productPaymentUrl && (
            <Button
              className="w-full"
              onClick={() => {
                logClick(null, "buy_product_cta");
                window.open(popup.payload.productPaymentUrl!, "_blank", "noopener,noreferrer");
              }}
            >
              {popup.payload.productCtaLabel || "Buy now"}
            </Button>
          )}
          {popup?.payload.buttons && popup.payload.buttons.length > 0 && (
            <div className="flex flex-col gap-2">
              {popup.payload.buttons.map((b) => (
                <Button
                  key={b.id}
                  variant={b.style === "secondary" ? "outline" : "default"}
                  onClick={() => runPopupButton(b.action)}
                  style={{
                    ...(b.bgColor ? { backgroundColor: b.bgColor, borderColor: b.bgColor } : {}),
                    ...(b.textColor ? { color: b.textColor } : {}),
                  }}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image lightbox (opened only from the Enlarge button) */}
      <Dialog
        open={!!zoomImage}
        onOpenChange={(v) => {
          if (!v) {
            setZoomImage(null);
            setZoomPopup(null);
          }
        }}
      >
        <DialogContent
          className="max-w-[95vw] w-fit p-2 bg-transparent border-none shadow-none"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {zoomImage && (
            <div className="relative max-h-[90vh] max-w-[95vw]">
              <img
                src={zoomImage}
                alt="Zoomed"
                className="block max-h-[90vh] max-w-[95vw] w-auto h-auto rounded object-contain"
                draggable={false}
              />
              {(zoomPopup?.payload.hotspots || []).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-label={h.label || "Hotspot"}
                  onClick={(e) => {
                    e.stopPropagation();
                    runPopupButton(h.action, true);
                  }}
                  className={`absolute border-2 border-primary/70 bg-primary/10 hover:bg-primary/30 transition cursor-pointer ${
                    h.shape === "ellipse" ? "rounded-full" : "rounded-sm"
                  }`}
                  style={{
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`,
                    width: `${h.width * 100}%`,
                    height: `${h.height * 100}%`,
                  }}
                  title={h.label}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video */}
      <Dialog open={!!video} onOpenChange={(v) => !v && setVideo(null)}>
        <DialogContent className="max-w-3xl">
          {video && (
            <div className="aspect-video w-full">
              {/youtube\.com|youtu\.be|vimeo\.com/.test(video) ? (
                <iframe
                  src={video.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="h-full w-full rounded"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <video src={video} controls autoPlay className="h-full w-full rounded" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Intro audio tap prompt (autoplay blocked) */}
      {introNeedsTap && !audioInfo && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-medium shadow-elegant backdrop-blur">
          🔊 Tap anywhere to play sound
        </div>
      )}
      {/* Audio mini-player (fixed bottom) */}
      {audioInfo && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 shadow-elegant backdrop-blur">
          <span className="text-xs font-medium">♪ Now playing{audioInfo.loop ? " (loop)" : ""}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              audioRef.current?.pause();
              if (audioRef.current) audioRef.current.currentTime = 0;
              setAudioInfo(null);
            }}
          >
            Stop
          </Button>
        </div>
      )}
      <Dialog open={!!formAction} onOpenChange={(v) => !v && setFormAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formAction?.payload.title || (formAction?.type === "rsvp" ? "RSVP" : "Get in touch")}
            </DialogTitle>
            {formAction?.payload.body && <DialogDescription>{formAction.payload.body}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3">
            {((formAction?.type === "rsvp" ? formAction?.payload.rsvpFields : formAction?.payload.fields) || []).map((f) => (
              <div key={f}>
                <Label className="text-xs capitalize">{f}</Label>
                <Input
                  type={f === "email" ? "email" : f === "phone" ? "tel" : "text"}
                  value={formData[f] || ""}
                  onChange={(e) => setFormData((d) => ({ ...d, [f]: e.target.value }))}
                />
              </div>
            ))}
            <Button onClick={submitForm} className="w-full">
              {formAction?.type === "rsvp" ? "Confirm RSVP" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout confirmation */}
      <Dialog open={!!confirmAction} onOpenChange={(v) => !v && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.payload.title || "Continue?"}</DialogTitle>
            {confirmAction?.payload.body && <DialogDescription>{confirmAction.payload.body}</DialogDescription>}
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (confirmAction?.payload.checkoutUrl) {
                  logClick(null, "checkout_confirm");
                  window.open(confirmAction.payload.checkoutUrl, "_blank", "noopener,noreferrer");
                }
                setConfirmAction(null);
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coupon */}
      <CouponDialog action={coupon} onClose={() => setCoupon(null)} onRedeem={(url) => { logClick(null, "coupon_redeem"); window.open(url, "_blank", "noopener,noreferrer"); }} />

      <AirMessagesDialog
        action={airMessages?.action ?? null}
        sourceLayer={airMessages?.layer ?? null}
        scale={scale}
        canvasW={W}
        canvasH={H}
        onClose={() => setAirMessages(null)}
        onRunBubbleAction={(a) => {
          logClick(null, "air_message:" + a.type);
          executeAction(a, null);
        }}
      />

      <PollDialog
        action={poll}
        onClose={() => setPoll(null)}
        flyerId={flyer.id}
        previewMode={previewMode}
      />
    </div>
  );
}

function CouponDialog({
  action, onClose, onRedeem,
}: { action: LayerAction | null; onClose: () => void; onRedeem: (url: string) => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (action) {
      setUnlocked(!action.payload.couponUnlock);
      setInput("");
      setError("");
      setCopied(false);
    }
  }, [action?.id]);

  if (!action) return null;
  const p = action.payload;

  function tryUnlock() {
    const expected = (p.couponUnlockCode || "").trim().toLowerCase();
    if (input.trim().toLowerCase() === expected) {
      setUnlocked(true);
      setError("");
    } else {
      setError("Wrong code, try again.");
    }
  }

  function copy() {
    if (!p.couponCode) return;
    navigator.clipboard.writeText(p.couponCode).then(() => {
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <Dialog open={!!action} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.title || "Your coupon"}</DialogTitle>
          {p.body && <DialogDescription>{p.body}</DialogDescription>}
        </DialogHeader>
        {!unlocked ? (
          <div className="space-y-3">
            <Label className="text-xs">Enter unlock code</Label>
            <Input
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
              placeholder="Code"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={tryUnlock} disabled={!input.trim()}>Unlock</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {p.couponImageUrl && <img src={p.couponImageUrl} alt="Coupon" className="w-full rounded" />}
            {p.couponCode && (
              <div className="flex items-center gap-2 rounded border-2 border-dashed border-primary bg-primary/5 p-3">
                <code className="flex-1 text-center font-mono text-lg font-bold tracking-wider">{p.couponCode}</code>
                <Button size="sm" variant="ghost" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            {p.couponRedeemUrl && (
              <Button className="w-full" onClick={() => onRedeem(p.couponRedeemUrl!)}>Redeem now</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AirMessagesDialog — iMessage-style bubble sequence
// ---------------------------------------------------------------------------

const REACTION_EMOJI: Record<string, string> = {
  heart: "❤️",
  like: "👍",
  dislike: "👎",
  haha: "😂",
  exclaim: "‼️",
  question: "❓",
};

function AirMessagesDialog({
  action, sourceLayer, scale, canvasW, canvasH, onClose, onRunBubbleAction,
}: {
  action: LayerAction | null;
  sourceLayer: Layer | null;
  scale: number;
  canvasW: number;
  canvasH: number;
  onClose: () => void;
  onRunBubbleAction: (a: LayerAction) => void;
}) {
  const bubbles: AirMessageBubble[] = action?.payload.bubbles || [];
  const stagger = action?.payload.bubbleStaggerMs ?? 900;
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (!action) { setVisible(0); return; }
    setVisible(0);
    const timers: number[] = [];
    bubbles.forEach((_, i) => {
      timers.push(window.setTimeout(() => {
        setVisible((v) => Math.max(v, i + 1));
      }, i * stagger + 250));
    });
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action?.id]);

  if (!action) return null;

  // Layout: if we have a source layer, render the bubbles at that exact canvas
  // rect (scaled to viewport). Otherwise fall back to a centered overlay.
  const useLayer = !!sourceLayer;
  const rect = useLayer
    ? {
        left: sourceLayer!.position.x * scale,
        top: sourceLayer!.position.y * scale,
        width: sourceLayer!.size.width * scale,
        height: sourceLayer!.size.height * scale,
      }
    : {
        left: canvasW * scale * 0.08,
        top: canvasH * scale * 0.35,
        width: canvasW * scale * 0.84,
        height: canvasH * scale * 0.30,
      };

  const gap = 10 * scale;
  const perBubbleHeight = bubbles.length > 0
    ? Math.max(28, (rect.height - gap * (bubbles.length - 1)) / bubbles.length)
    : 60;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "transparent",
        pointerEvents: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap,
        }}
      >
        {bubbles.slice(0, visible).map((b) => {
          const hasAction = !!b.action;
          return (
            <div
              key={b.id}
              style={{
                animation: "airBubbleIn 320ms cubic-bezier(0.34,1.56,0.64,1) both",
                width: "100%", display: "flex", justifyContent: "center",
              }}
            >
              <AirBubble
                bubble={b}
                maxWidth={rect.width}
                fitHeight={perBubbleHeight}
                interactive={hasAction}
                onClick={() => hasAction && onRunBubbleAction(b.action!)}
              />
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes airBubbleIn {
          0% { opacity: 0; transform: translateY(12px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PollDialog — anonymous, live results
// ---------------------------------------------------------------------------

const POLL_SESSION_KEY = "ff_poll_session";
function getPollSessionId(): string {
  try {
    let id = localStorage.getItem(POLL_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(POLL_SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

function PollDialog({
  action, onClose, flyerId, previewMode,
}: {
  action: LayerAction | null;
  onClose: () => void;
  flyerId: string;
  previewMode: boolean;
}) {
  const question = action?.payload.pollQuestion || "";
  const options = action?.payload.pollOptions || [];
  const multiple = !!action?.payload.pollMultiple;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const sessionId = useMemo(() => getPollSessionId(), []);

  // Load counts + check if I already voted
  useEffect(() => {
    if (!action) return;
    setVoted(false);
    setMyVotes(new Set());
    setCounts({});
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("poll_votes")
        .select("option_id, session_id")
        .eq("action_id", action.id);
      if (cancelled) return;
      const c: Record<string, number> = {};
      const mine = new Set<string>();
      (data || []).forEach((row: any) => {
        c[row.option_id] = (c[row.option_id] || 0) + 1;
        if (row.session_id === sessionId) mine.add(row.option_id);
      });
      setCounts(c);
      setMyVotes(mine);
      if (mine.size > 0) setVoted(true);
    })();
    return () => { cancelled = true; };
  }, [action?.id, sessionId]);

  // Realtime subscription
  useEffect(() => {
    if (!action) return;
    const channel = supabase
      .channel(`poll-${action.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "poll_votes", filter: `action_id=eq.${action.id}` },
        (payload: any) => {
          const row = payload.new;
          setCounts((c) => ({ ...c, [row.option_id]: (c[row.option_id] || 0) + 1 }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [action?.id]);

  if (!action) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  async function vote(optionId: string) {
    if (voted && !multiple) return;
    if (myVotes.has(optionId)) return;
    if (previewMode) {
      toast.info("Voting is disabled in preview mode");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("poll_votes").insert([{
      action_id: action!.id,
      flyer_id: flyerId,
      session_id: sessionId,
      option_id: optionId,
    }] as any);
    setLoading(false);
    if (error) {
      toast.error("Could not record your vote");
      return;
    }
    // Optimistic update (realtime will also fire, dedupe via unique index already prevents dupes)
    setMyVotes((m) => new Set(m).add(optionId));
    if (!multiple) setVoted(true);
    toast.success("Vote recorded");
  }

  const showResults = voted || myVotes.size > 0;

  return (
    <Dialog open={!!action} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{question || "Poll"}</DialogTitle>
          <DialogDescription>
            {multiple ? "Pick all that apply." : "Tap an option to vote."} {total > 0 && `· ${total} vote${total === 1 ? "" : "s"}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.map((o) => {
            const c = counts[o.id] || 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            const mine = myVotes.has(o.id);
            const disabled = (voted && !multiple && !mine) || mine;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => vote(o.id)}
                disabled={disabled || loading}
                className={`relative w-full overflow-hidden rounded-md border text-left transition ${
                  mine
                    ? "border-primary bg-primary/5"
                    : disabled
                    ? "border-border bg-muted/30"
                    : "border-border bg-card hover:border-primary/60 hover:bg-primary/5"
                }`}
              >
                {showResults && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/15 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {mine && <Check className="h-4 w-4 text-primary" />}
                    {o.label || "(empty)"}
                  </span>
                  {showResults && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {pct}% · {c}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {showResults && (
          <p className="text-center text-[11px] text-muted-foreground">
            {multiple ? "Tap more options to add votes." : "Thanks for voting!"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
