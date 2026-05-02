import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Stage, Layer as KLayer, Rect, Circle, Ellipse, Line, Text, Image as KonvaImage, Group } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import * as LucideIcons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { supabase } from "@/integrations/supabase/client";
import { Flyer, FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { IntroAnimatedGroup, resolveIntro } from "@/components/editor/IntroAnimatedGroup";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioInfo, setAudioInfo] = useState<{ url: string; loop: boolean } | null>(null);

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

  function runPopupButton(a: LayerAction) {
    logClick(null, "popup_button:" + a.type);
    setPopup(null);
    // small delay so the dialog closes before next opens
    setTimeout(() => executeAction(a, null), 50);
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

  // Fit-to-screen scale
  const maxW = typeof window !== "undefined" ? Math.min(window.innerWidth - 32, W) : W;
  const scale = maxW / W;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
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
      <div style={{ width: W * scale, height: H * scale, background: page.background.color || "#fff" }} className="shadow-elegant">
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
            <DialogTitle>{popup?.payload.title || (popup?.type === "buy_ticket" ? "Get your ticket" : "Info")}</DialogTitle>
            {popup?.payload.body && <DialogDescription>{popup.payload.body}</DialogDescription>}
          </DialogHeader>
          {popup?.type === "buy_ticket" && popup.payload.ticketImageUrl && (
            <img src={popup.payload.ticketImageUrl} alt="Ticket" className="w-full rounded" />
          )}
          {popup?.type !== "buy_ticket" && popup?.payload.mediaUrl && (
            <img src={popup.payload.mediaUrl} alt="" className="w-full rounded" />
          )}
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
