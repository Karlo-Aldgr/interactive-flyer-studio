import { useEffect, useMemo, useRef, useState } from "react";

/** Resolve true once every provided image src has loaded (or errored / timed out). */
function useImagesReady(srcs: string[], timeoutMs = 4000): boolean {
  const key = srcs.filter(Boolean).join("|");
  const [ready, setReady] = useState(srcs.length === 0);
  useEffect(() => {
    const list = srcs.filter(Boolean);
    if (list.length === 0) { setReady(true); return; }
    setReady(false);
    let done = 0;
    let cancelled = false;
    const finish = () => { if (!cancelled && ++done >= list.length) setReady(true); };
    const imgs = list.map((src) => {
      const img = new Image();
      img.onload = finish;
      img.onerror = finish;
      img.src = src;
      return img;
    });
    const t = setTimeout(() => { if (!cancelled) setReady(true); }, timeoutMs);
    return () => { cancelled = true; clearTimeout(t); imgs.forEach((i) => { i.onload = null; i.onerror = null; }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeoutMs]);
  return ready;
}

/** Stable per-browser session id used to compute unique/return visitors in analytics. */
function getViewerSessionId(): string {
  try {
    const k = "ff_viewer_sid";
    let v = localStorage.getItem(k);
    if (!v) {
      v = (crypto as any)?.randomUUID?.() || `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

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
import { Loader2, Copy, Check, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import AppointmentBookingDialog from "@/components/viewer/AppointmentBookingDialog";
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

// ---------------------------------------------------------------------------
// Konva-rendered air-message bubbles — kept inside the Stage so they respect
// per-layer z_index ordering (the previous HTML overlay always sat above
// every layer, breaking layering for images placed on top of bubbles).
// ---------------------------------------------------------------------------

function applyBubbleCase(text: string, c?: string): string {
  if (c === "upper") return text.toUpperCase();
  if (c === "lower") return text.toLowerCase();
  return text;
}

function estimateBubbleFontSize(text: string, width: number, height: number, manual?: number) {
  if (manual) return manual;
  const availableW = Math.max(16, width - Math.max(28, height * 0.64));
  const availableH = Math.max(12, height - Math.max(16, height * 0.36));
  let size = Math.min(36, Math.max(14, availableH * 0.62));
  while (size > 12) {
    const charsPerLine = Math.max(1, Math.floor(availableW / (size * 0.56)));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    if (lines * size * 1.05 <= availableH + 2) break;
    size -= 1;
  }
  return size;
}

function KonvaBubble({
  bubble, width, height, interactive, onTap,
}: {
  bubble: AirMessageBubble;
  width: number;
  height: number;
  interactive: boolean;
  onTap: () => void;
}) {
  const [img] = useImage(bubble.imageUrl || "", "anonymous");
  const text = applyBubbleCase(bubble.text || "", bubble.textCase);
  const bg1 = bubble.bgColor || "#1d9bf0";
  const bg2 = bubble.bgColor2 || bg1;
  const textColor = bubble.textColor || "#ffffff";
  const padX = Math.max(14, Math.round(height * 0.32));
  const padY = Math.max(8, Math.round(height * 0.18));
  const imageSize = bubble.imageUrl ? Math.max(16, height - padY * 2) : 0;
  const textX = bubble.imageUrl ? padX + imageSize + 8 : padX;
  const fontSize = estimateBubbleFontSize(text, width - (bubble.imageUrl ? imageSize + 8 : 0), height, bubble.fontSize);
  const tailSize = Math.max(10, Math.round(height * 0.18));
  const tail = bubble.tail ?? "down";
  const gradient = bg1 !== bg2;

  const rectFill: any = gradient
    ? { fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: width, y: height }, fillLinearGradientColorStops: [0, bg1, 1, bg2] }
    : { fill: bg1 };

  const handleEnter = (e: any) => {
    if (!interactive) return;
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = "pointer";
  };
  const handleLeave = (e: any) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = "default";
  };

  return (
    <Group
      onClick={interactive ? onTap : undefined}
      onTap={interactive ? onTap : undefined}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      listening={interactive}
    >
      <Rect width={width} height={height} cornerRadius={height / 2} shadowColor="rgba(0,0,0,0.28)" shadowBlur={14} shadowOffsetY={4} shadowOpacity={0.5} {...rectFill} />
      {tail !== "none" && (
        <Line
          closed
          points={
            tail === "up"
              ? [width / 2 - tailSize, 1, width / 2 + tailSize, 1, width / 2, -tailSize]
              : tail === "left"
                ? [1, height / 2 - tailSize, 1, height / 2 + tailSize, -tailSize, height / 2]
                : tail === "right"
                  ? [width - 1, height / 2 - tailSize, width - 1, height / 2 + tailSize, width + tailSize, height / 2]
                  : [width / 2 - tailSize, height - 1, width / 2 + tailSize, height - 1, width / 2, height + tailSize]
          }
          fill={tail === "up" || tail === "left" ? bg1 : bg2}
        />
      )}
      {img && bubble.imageUrl && (
        <KonvaImage image={img} x={padX} y={padY} width={imageSize} height={imageSize} cornerRadius={12} />
      )}
      <Text
        x={textX}
        y={padY}
        width={Math.max(10, width - textX - padX)}
        height={Math.max(10, height - padY * 2)}
        text={text}
        fontSize={fontSize}
        fontStyle={bubble.bold === false ? "500" : "800"}
        fill={textColor}
        align="center"
        verticalAlign="middle"
        wrap="word"
        ellipsis
        listening={false}
      />
    </Group>
  );
}

function KonvaAirMessages({
  action, sourceLayer, canvasW, canvasH, onClose, onRunBubbleAction,
}: {
  action: LayerAction;
  sourceLayer: Layer | null;
  canvasW: number;
  canvasH: number;
  onClose: () => void;
  onRunBubbleAction: (a: LayerAction) => void;
}) {
  const bubbles: AirMessageBubble[] = action.payload.bubbles || [];
  const stagger = action.payload.bubbleStaggerMs ?? 900;
  const startDelay = Math.max(0, action.payload.bubbleStartDelayMs ?? 0);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    const timers: number[] = [];
    bubbles.forEach((b, i) => {
      const t = (typeof b.delayMs === "number" ? b.delayMs : i * stagger) + 250 + startDelay;
      timers.push(window.setTimeout(() => {
        setVisible((v) => Math.max(v, i + 1));
      }, t));
    });
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.id]);

  const rect = sourceLayer
    ? { x: sourceLayer.position.x, y: sourceLayer.position.y, width: sourceLayer.size.width, height: sourceLayer.size.height }
    : { x: canvasW * 0.08, y: canvasH * 0.35, width: canvasW * 0.84, height: canvasH * 0.30 };

  const gap = 10;
  const count = Math.max(1, bubbles.length);
  const perBubbleHeight = Math.max(28, (rect.height - gap * (count - 1)) / count);
  const closeR = 11;

  return (
    <Group x={rect.x} y={rect.y}>
      {bubbles.slice(0, visible).map((b, i) => {
        const hasAction = !!b.action;
        return (
          <Group key={b.id} y={i * (perBubbleHeight + gap)}>
            <KonvaBubble
              bubble={b}
              width={rect.width}
              height={perBubbleHeight}
              interactive={hasAction}
              onTap={() => hasAction && onRunBubbleAction(b.action!)}
            />
          </Group>
        );
      })}
      {/* Close button — top-right of the bubble cluster */}
      <Group
        x={rect.width - closeR}
        y={-closeR}
        onClick={onClose}
        onTap={onClose}
        onMouseEnter={(e: any) => { const s = e.target.getStage(); if (s) s.container().style.cursor = "pointer"; }}
        onMouseLeave={(e: any) => { const s = e.target.getStage(); if (s) s.container().style.cursor = "default"; }}
      >
        <Circle radius={closeR} fill="rgba(0,0,0,0.55)" />
        <Text
          x={-closeR}
          y={-closeR}
          width={closeR * 2}
          height={closeR * 2}
          text="×"
          fill="#fff"
          fontSize={closeR * 1.5}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      </Group>
    </Group>
  );
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
    listening: hasAction || l.type === "hotspot",
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
  const [popupImageReady, setPopupImageReady] = useState(false);
  const [zoomImageReady, setZoomImageReady] = useState(false);
  useEffect(() => { setPopupImageReady(false); setPopupQty(1); }, [popup?.id, popup?.payload?.mediaUrl]);
  useEffect(() => { setZoomImageReady(false); }, [zoomImage]);
  const [enlarged, setEnlarged] = useState(false);
  const [airMessages, setAirMessages] = useState<Array<{ action: LayerAction; layer: Layer | null }>>([]);
  const [poll, setPoll] = useState<LayerAction | null>(null);
  const [subscribeAction, setSubscribeAction] = useState<LayerAction | null>(null);
  const [subscribeData, setSubscribeData] = useState<{ name: string; email: string; phone: string }>({ name: "", email: "", phone: "" });
  const [appointmentAction, setAppointmentAction] = useState<{ action: LayerAction; layer: Layer | null } | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  // Shopping cart for buy_product actions with productCartEnabled
  type CartItem = {
    id: string; // stable per product
    name: string;
    price: number; // numeric, 0 if not parseable
    priceDisplay: string;
    currency: string;
    image?: string;
    qty: number;
  };
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [popupQty, setPopupQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [payLaterConfirmOpen, setPayLaterConfirmOpen] = useState(false);
  const [payLaterAccepted, setPayLaterAccepted] = useState(false);
  const [payLaterSubmitting, setPayLaterSubmitting] = useState(false);
  function addToCart(a: LayerAction, layer: Layer | null, qty: number = 1) {
    const p = a.payload;
    const id = p.productId || layer?.id || a.id;
    const priceNum = Number(String(p.productPrice ?? "").replace(/[^0-9.]/g, "")) || 0;
    const addQty = Math.max(1, Math.floor(qty || 1));
    setCart((prev) => {
      const existing = prev.find((it) => it.id === id);
      if (existing) return prev.map((it) => (it.id === id ? { ...it, qty: it.qty + addQty } : it));
      return [
        ...prev,
        {
          id,
          name: p.productName || "Product",
          price: priceNum,
          priceDisplay: p.productPrice || "",
          currency: p.productCurrency || "",
          image: p.productImageUrl,
          qty: addQty,
        },
      ];
    });
    toast.success(`Added ${addQty} × "${p.productName || "Product"}" to cart`);
  }
  const cartCount = cart.reduce((n, it) => n + it.qty, 0);
  const cartTotal = cart.reduce((n, it) => n + it.price * it.qty, 0);
  const cartCurrency = cart.find((it) => it.currency)?.currency || "";
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
        const sid = getViewerSessionId();
        const { error: trackErr } = await supabase
          .from("analytics_events")
          .insert([{ flyer_id: f.id, event_type: "view", session_id: sid, metadata: { referrer: document.referrer || null } } as any]);
        if (trackErr) console.warn("[analytics] view insert failed", trackErr);
      }
    })();
  }, [slug, flyerId, previewMode]);

  // Dynamically set document title and OG meta tags so social previews
  // (iMessage, etc. — anything that executes JS) match the actual flyer.
  useEffect(() => {
    if (!flyer) return;
    const title = flyer.title || "Flyer";
    const description = `View "${title}" — interactive flyer.`;
    const image =
      (flyer as any).thumbnail_url ||
      `${window.location.origin}/og.png`;
    const url = window.location.href;

    const prevTitle = document.title;
    document.title = title;

    const setMeta = (selector: string, attr: string, name: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMeta(`meta[property="og:title"]`, "property", "og:title", title);
    setMeta(`meta[property="og:description"]`, "property", "og:description", description);
    setMeta(`meta[property="og:image"]`, "property", "og:image", image);
    setMeta(`meta[property="og:url"]`, "property", "og:url", url);
    setMeta(`meta[name="description"]`, "name", "description", description);
    setMeta(`meta[name="twitter:title"]`, "name", "twitter:title", title);
    setMeta(`meta[name="twitter:description"]`, "name", "twitter:description", description);
    setMeta(`meta[name="twitter:image"]`, "name", "twitter:image", image);

    return () => {
      document.title = prevTitle;
    };
  }, [flyer]);

  function logAnalyticsEvent(row: Record<string, any>) {
    if (!flyer || previewMode) return;
    const payload: Record<string, any> = { flyer_id: flyer.id, session_id: getViewerSessionId(), ...row };
    // Critical for tel:, sms:, and payment links: keepalive lets the click be
    // saved even when the browser immediately leaves the page.
    try {
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;
      const apikey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      fetch(url, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey,
          authorization: `Bearer ${apikey}`,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      }).then((res) => {
        if (!res.ok) console.warn("[analytics] insert failed", res.status, payload);
      }).catch((error) => console.warn("[analytics] insert failed", error, payload));
    } catch {}
  }

  function logClick(layer: Layer | null, type: string, metadata: Record<string, any> = {}) {
    logAnalyticsEvent({
      page_id: layer?.page_id ?? null,
      layer_id: layer?.id ?? null,
      event_type: "click",
      metadata: { ...metadata, action_type: type } as any,
    });
  }

  // Best-effort beacon on tab close so a quick visit still records a view.
  useEffect(() => {
    if (!flyer || previewMode) return;
    const onHide = () => {
      try {
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;
        const apikey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const body = JSON.stringify({
          flyer_id: flyer.id,
          event_type: "view",
          session_id: getViewerSessionId(),
          metadata: { beacon: true, referrer: document.referrer || null },
        });
        const blob = new Blob(
          [JSON.stringify({ apikey, authorization: `Bearer ${apikey}`, body })],
          { type: "application/json" },
        );
        // Primary: keepalive fetch (carries headers properly)
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            apikey,
            authorization: `Bearer ${apikey}`,
            "content-type": "application/json",
            prefer: "return=minimal",
          },
          body,
        }).catch(() => {});
        void blob;
      } catch {}
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flyer, previewMode]);

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
        if (a.payload.productName) {
          // Reuse the buy_product popup flow (with quantity picker + cart)
          setPopup({
            ...a,
            type: "buy_product",
            payload: { ...a.payload, productCartEnabled: true },
          });
        } else if (a.payload.title) setConfirmAction(a);
        else if (a.payload.checkoutUrl) window.open(a.payload.checkoutUrl, "_blank", "noopener,noreferrer");
        break;
      case "coupon":
        setCoupon(a);
        break;
      case "air_messages":
        setAirMessages((prev) => (prev.some((p) => p.action.id === a.id) ? prev : [...prev, { action: a, layer: layer ?? null }]));
        break;
      case "poll":
        setPoll(a);
        break;
      case "subscribe":
        setSubscribeAction(a);
        setSubscribeData({ name: "", email: "", phone: "" });
        break;
      case "book_appointment":
        setAppointmentAction({ action: a, layer });
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
    logClick(null, a.type, { source: "popup_button" });
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

  async function submitSubscribe() {
    if (!subscribeAction || !flyer) return;
    const p = subscribeAction.payload;
    const nameRequired = p.subscribeNameRequired ?? true;
    const phoneEnabled = !!p.subscribePhoneEnabled;
    const phoneRequired = phoneEnabled && !!p.subscribePhoneRequired;
    const email = subscribeData.email.trim();
    const name = subscribeData.name.trim();
    const phone = subscribeData.phone.trim();
    if (nameRequired && !name) return toast.error("Please enter your name");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Please enter a valid email");
    if (phoneRequired && !phone) return toast.error("Please enter your phone");
    if (name.length > 200 || email.length > 320 || phone.length > 40) return toast.error("Input too long");
    setSubscribing(true);
    const { error } = await supabase.from("subscribers").insert([{
      flyer_id: flyer.id,
      name: name || null,
      email: email.toLowerCase(),
      phone: phoneEnabled && phone ? phone : null,
      list_name: p.subscribeListName || null,
      source: "subscribe",
    }]);
    setSubscribing(false);
    if (error && (error as any).code !== "23505") {
      console.error("[subscribe]", error);
      toast.error("Could not subscribe — try again");
      return;
    }
    toast.success(p.subscribeSuccessMessage || "You're in! Thanks for subscribing.");
    setSubscribeAction(null);
  }

  // Intro audio: auto-start on flyer load. If the browser blocks unmuted
  // autoplay (common on mobile Safari), fall back to muted autoplay so the
  // track still begins immediately and the user can pinch/pan freely. A
  // small pill then offers a one-tap unmute.
  useEffect(() => {
    if (!flyer) return;
    const url = flyer.settings?.introAudioUrl;
    if (!url || introPlayedRef.current) return;
    const loop = !!flyer.settings?.introAudioLoop;
    const el = new Audio(url);
    el.loop = loop;
    el.onended = () => setAudioInfo((s) => (s?.url === url ? null : s));
    audioRef.current = el;

    const tryPlay = async () => {
      if (introPlayedRef.current) return;
      try {
        el.muted = false;
        el.currentTime = 0;
        await el.play();
        introPlayedRef.current = true;
        setAudioInfo({ url, loop });
        setIntroNeedsTap(false);
      } catch {
        // Unmuted autoplay blocked (mobile Safari / Chrome). Do NOT fall back
        // to muted autoplay — that causes the track to advance silently and
        // become audible mid-song after the first tap. Instead, keep the
        // audio paused at 0:00 and let the first user gesture start it.
        try { el.pause(); } catch { /* noop */ }
        el.currentTime = 0;
        setIntroNeedsTap(true);

        // First user interaction of any kind: start playback synchronously
        // from the beginning. Must run inside the gesture handler so the
        // play() call is allowed by the browser.
        const startFromTap = () => {
          try {
            el.muted = false;
            el.currentTime = 0;
            const p = el.play();
            if (p && typeof p.then === "function") {
              p.then(() => {
                introPlayedRef.current = true;
                setAudioInfo({ url, loop });
                setIntroNeedsTap(false);
              }).catch(() => { /* user can tap the prompt button */ });
            } else {
              introPlayedRef.current = true;
              setAudioInfo({ url, loop });
              setIntroNeedsTap(false);
            }
          } catch { /* noop */ }
          cleanup();
        };
        const cleanup = () => {
          window.removeEventListener("pointerdown", startFromTap, true);
          window.removeEventListener("touchend", startFromTap, true);
          window.removeEventListener("mousedown", startFromTap, true);
          window.removeEventListener("keydown", startFromTap, true);
        };
        window.addEventListener("pointerdown", startFromTap, true);
        window.addEventListener("touchend", startFromTap, true);
        window.addEventListener("mousedown", startFromTap, true);
        window.addEventListener("keydown", startFromTap, true);
      }
    };

    tryPlay();
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
      setTimeout(() => {
        logClick(l, a.type, { source: "auto_trigger" });
        executeAction(a, l);
      }, 350 + i * 250);
      i++;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, loading, flyer?.id, pages.length]);

  // Wait for image layers to load before drawing hotspot/highlight overlays so
  // viewers see the image first, never naked rings on a blank background.
  // NOTE: hooks must be called before any early return.
  const currentPage = pages[pageIndex];
  const pageImageSrcs = useMemo(
    () =>
      (currentPage?.layers || [])
        .filter((l) => l.type === "image" && l.content.src)
        .map((l) => l.content.src!),
    [currentPage?.id, currentPage?.layers],
  );
  const imagesReady = useImagesReady(pageImageSrcs);

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

  const page = currentPage;
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
                // Air-message bubbles anchored to this layer — render in the
                // same z slot so layers above (e.g. an icon) can occlude them.
                const attachedBubbles = airMessages.filter((am) => am.layer?.id === l.id);
                return (
                  <Group key={l.id}>
                    <IntroAnimatedGroup
                      preset={cfg.preset}
                      durationMs={cfg.durationMs}
                      delayMs={delay}
                      cx={cx}
                      cy={cy}
                      introKey={`${page.id}:${pageIndex}:${imagesReady ? "ready" : "wait"}`}
                    >
                      {node}
                    </IntroAnimatedGroup>
                    {attachedBubbles.map((am) => (
                      <KonvaAirMessages
                        key={am.action.id}
                        action={am.action}
                        sourceLayer={am.layer}
                        canvasW={W}
                        canvasH={H}
                        onClose={() => setAirMessages((prev) => prev.filter((p) => p.action.id !== am.action.id))}
                        onRunBubbleAction={(a) => {
                          logClick(am.layer, a.type, { source: "air_message", parent_action_type: "air_messages" });
                          executeAction(a, null);
                        }}
                      />
                    ))}
                  </Group>
                );
              });
            })()}
            {/* Page-level air messages (no source layer) — render on top */}
            {airMessages.filter((am) => !am.layer).map((am) => (
              <KonvaAirMessages
                key={am.action.id}
                action={am.action}
                sourceLayer={null}
                canvasW={W}
                canvasH={H}
                onClose={() => setAirMessages((prev) => prev.filter((p) => p.action.id !== am.action.id))}
                onRunBubbleAction={(a) => {
                  logClick(null, a.type, { source: "air_message", parent_action_type: "air_messages" });
                  executeAction(a, null);
                }}
              />
            ))}
          </KLayer>
          {/* Pulsing highlights to indicate tappable hotspots */}
          {imagesReady && (flyer.settings?.highlightsEnabled ?? true) && (
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
          {imagesReady && previewMode && showHitboxes && (
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
        {/* Air-message bubbles are rendered inside the Konva Stage so they
            respect per-layer z_index ordering. */}
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
        <DialogContent
          style={{
            background:
              popup?.type === "buy_product" || popup?.type === "buy_ticket"
                ? "#ffffff"
                : popup?.type === "popup" && !popup?.payload.mediaUrl
                ? popup.payload.popupBgColor || "#ffffff"
                : page?.background?.color || undefined,
            color:
              popup?.type === "buy_product" || popup?.type === "buy_ticket"
                ? "#000000"
                : popup?.type === "popup" && !popup?.payload.mediaUrl
                ? popup.payload.popupTextColor || "#000000"
                : popup?.type === "popup" && popup?.payload.popupTextColor
                ? popup.payload.popupTextColor
                : undefined,
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "inherit" }}>{popup?.payload.title || (popup?.type === "buy_ticket" ? "Get your ticket" : popup?.type === "buy_product" ? (popup.payload.productName || "Buy product") : "Info")}</DialogTitle>
            {popup?.payload.body && <DialogDescription style={{ color: "inherit", opacity: 0.9 }}>{popup.payload.body}</DialogDescription>}
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
                onLoad={() => setPopupImageReady(true)}
                onError={() => setPopupImageReady(true)}
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
              {popupImageReady && (popup.payload.hotspots || []).map((h) => (
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
          {popup?.type === "buy_product" && popup.payload.productCartEnabled && (() => {
            const unit = Number(String(popup.payload.productPrice ?? "").replace(/[^0-9.]/g, "")) || 0;
            const cur = popup.payload.productCurrency ? `${popup.payload.productCurrency} ` : "";
            const subtotal = unit * popupQty;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">Quantity</span>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      className="h-8 w-8 rounded-md border border-border hover:bg-muted disabled:opacity-50"
                      disabled={popupQty <= 1}
                      onClick={() => setPopupQty((q) => Math.max(1, q - 1))}
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={popupQty}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setPopupQty(Number.isFinite(n) && n > 0 ? Math.min(999, n) : 1);
                      }}
                      className="h-8 w-14 rounded-md border border-border bg-background text-center text-sm"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      className="h-8 w-8 rounded-md border border-border hover:bg-muted"
                      onClick={() => setPopupQty((q) => Math.min(999, q + 1))}
                    >+</button>
                  </div>
                </div>
                {unit > 0 && (
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="text-base font-semibold">{cur}{subtotal.toFixed(2)}</span>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => {
                    logClick(null, "buy_product_add_to_cart");
                    addToCart(popup, null, popupQty);
                    setPopup(null);
                    setCartOpen(true);
                  }}
                >
                  <LucideIcons.ShoppingCart className="h-4 w-4 mr-2" />
                  {popup.payload.productCtaLabel || "Add to cart"}
                </Button>
              </div>
            );
          })()}
          {popup?.type === "buy_product" && !popup.payload.productCartEnabled && popup.payload.productPaymentUrl && (
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
                onLoad={() => setZoomImageReady(true)}
                onError={() => setZoomImageReady(true)}
              />
              {zoomImageReady && (zoomPopup?.payload.hotspots || []).map((h) => (
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

      {/* Intro audio unmute prompt — only show if audio is NOT already playing */}
      {introNeedsTap && !audioInfo && (
        <button
          onClick={() => {
            const el = audioRef.current;
            if (el) {
              el.muted = false;
              el.currentTime = 0;
              el.play()
                .then(() => {
                  introPlayedRef.current = true;
                  setAudioInfo({ url: el.src, loop: el.loop });
                })
                .catch(() => {});
            }
            setIntroNeedsTap(false);
          }}
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-medium shadow-elegant backdrop-blur"
        >
          🔊 Tap to play audio
        </button>
      )}
      {/* Audio mini-player — small pill at top-left so it never overlaps canvas buttons */}
      {audioInfo && (
        <div className="fixed top-3 left-3 z-50 flex items-center gap-2 rounded-full border border-border bg-card/95 px-2.5 py-1 shadow-elegant backdrop-blur">
          <span className="text-[11px] font-medium">♪{audioInfo.loop ? " loop" : ""}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
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

      {/* Appointment booking dialog */}
      {appointmentAction && flyer && (
        <AppointmentBookingDialog
          flyerId={flyer.id}
          layerId={appointmentAction.layer?.id || null}
          action={appointmentAction.action}
          open={!!appointmentAction}
          onClose={() => setAppointmentAction(null)}
        />
      )}

      {/* Subscribe dialog */}
      <Dialog open={!!subscribeAction} onOpenChange={(v) => !v && setSubscribeAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subscribeAction?.payload.subscribeTitle || "Join our list"}</DialogTitle>
            {subscribeAction?.payload.subscribeBody && (
              <DialogDescription>{subscribeAction.payload.subscribeBody}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">
                Name {(subscribeAction?.payload.subscribeNameRequired ?? true) ? "" : "(optional)"}
              </Label>
              <Input
                value={subscribeData.name}
                maxLength={200}
                onChange={(e) => setSubscribeData((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={subscribeData.email}
                maxLength={320}
                onChange={(e) => setSubscribeData((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
            {subscribeAction?.payload.subscribePhoneEnabled && (
              <div>
                <Label className="text-xs">
                  Phone {subscribeAction.payload.subscribePhoneRequired ? "" : "(optional)"}
                </Label>
                <Input
                  type="tel"
                  value={subscribeData.phone}
                  maxLength={40}
                  onChange={(e) => setSubscribeData((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
            )}
            <Button onClick={submitSubscribe} disabled={subscribing} className="w-full">
              {subscribing ? "Subscribing..." : (subscribeAction?.payload.subscribeButtonLabel || "Subscribe")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Air messages render inline inside the stage wrapper above (no floating overlay). */}

      <PollDialog
        action={poll}
        onClose={() => setPoll(null)}
        flyerId={flyer.id}
        previewMode={previewMode}
      />

      {/* Floating cart icon — appears only when there are items */}
      {cartCount > 0 && !cartOpen && (
        <button
          type="button"
          aria-label={`Open cart (${cartCount} item${cartCount === 1 ? "" : "s"})`}
          onClick={() => setCartOpen(true)}
          className="fixed top-3 right-16 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/95 shadow-elegant backdrop-blur hover:bg-card transition"
        >
          <LucideIcons.ShoppingCart className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {cartCount}
          </span>
        </button>
      )}

      {/* Cart drawer */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LucideIcons.ShoppingCart className="h-5 w-5" />
              Your cart
            </DialogTitle>
            <DialogDescription>
              {cart.length === 0 ? "Your cart is empty." : `${cartCount} item${cartCount === 1 ? "" : "s"}`}
            </DialogDescription>
          </DialogHeader>
          {cart.length > 0 && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {cart.map((it) => (
                <div key={it.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                  {it.image ? (
                    <img src={it.image} alt={it.name} className="h-14 w-14 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded bg-muted flex items-center justify-center">
                      <LucideIcons.Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.currency ? `${it.currency} ` : ""}{it.priceDisplay || it.price.toFixed(2)}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1">
                      <button
                        className="h-6 w-6 rounded border border-border hover:bg-muted"
                        onClick={() =>
                          setCart((prev) =>
                            prev
                              .map((x) => (x.id === it.id ? { ...x, qty: x.qty - 1 } : x))
                              .filter((x) => x.qty > 0)
                          )
                        }
                      >−</button>
                      <span className="text-xs w-6 text-center">{it.qty}</span>
                      <button
                        className="h-6 w-6 rounded border border-border hover:bg-muted"
                        onClick={() =>
                          setCart((prev) => prev.map((x) => (x.id === it.id ? { ...x, qty: x.qty + 1 } : x)))
                        }
                      >+</button>
                    </div>
                  </div>
                  <button
                    aria-label="Remove"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setCart((prev) => prev.filter((x) => x.id !== it.id))}
                  >
                    <LucideIcons.X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {cart.length > 0 && (
            <>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-semibold">
                  {cartCurrency ? `${cartCurrency} ` : ""}{cartTotal.toFixed(2)}
                </span>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
              >
                Checkout
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout form */}
      <Dialog
        open={checkoutOpen}
        onOpenChange={(v) => {
          setCheckoutOpen(v);
          if (!v) setCheckoutSuccess(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{checkoutSuccess ? "Almost done — pay now" : "Checkout"}</DialogTitle>
            <DialogDescription>
              {checkoutSuccess
                ? (() => {
                    const s = flyer?.settings || ({} as any);
                    const has = !!(s.payVenmo || s.payCashapp || s.payApplePayContact);
                    return has
                      ? "Your order has been recorded. Tap a payment app below to send the total — the seller will confirm once they receive payment."
                      : "Your order has been recorded. The seller hasn't set up an in-app payment method, so they'll contact you to arrange payment.";
                  })()
                : `Please share your contact details so we can confirm your order (${cartCount} item${cartCount === 1 ? "" : "s"}).`}
            </DialogDescription>
          </DialogHeader>
          {!checkoutSuccess && (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!flyer) return;
                if (!checkoutData.name || !checkoutData.email) {
                  toast.error("Name and email are required");
                  return;
                }
                if (previewMode) {
                  toast.success("Preview mode — order not submitted");
                  setCheckoutSuccess(true);
                  return;
                }
                setCheckoutSubmitting(true);
                const { data: inserted, error } = await supabase.from("form_submissions").insert([{
                  flyer_id: flyer.id,
                  data: {
                    kind: "cart_order",
                    customer: checkoutData,
                    items: cart,
                    total: cartTotal,
                    currency: cartCurrency,
                    submitted_at: new Date().toISOString(),
                  } as any,
                } as any]).select("id").single();
                setCheckoutSubmitting(false);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                setPlacedOrderId((inserted as any)?.id || null);
                logClick(null, "cart_checkout_submit");
                setCheckoutSuccess(true);
              }}
            >
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  className="mt-1"
                  required
                  value={checkoutData.name}
                  onChange={(e) => setCheckoutData((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  className="mt-1"
                  type="email"
                  required
                  value={checkoutData.email}
                  onChange={(e) => setCheckoutData((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  className="mt-1"
                  value={checkoutData.phone}
                  onChange={(e) => setCheckoutData((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Shipping address</Label>
                <Input
                  className="mt-1"
                  value={checkoutData.address}
                  onChange={(e) => setCheckoutData((d) => ({ ...d, address: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  className="mt-1"
                  value={checkoutData.notes}
                  onChange={(e) => setCheckoutData((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-base font-semibold">
                  {cartCurrency ? `${cartCurrency} ` : ""}{cartTotal.toFixed(2)}
                </span>
              </div>
              <Button type="submit" className="w-full" disabled={checkoutSubmitting}>
                {checkoutSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Place order"}
              </Button>
            </form>
          )}
          {checkoutSuccess && (() => {
            const s = (flyer?.settings || {}) as any;
            const venmoH = (s.payVenmo || "").replace(/^@/, "").trim();
            const cashH = (s.payCashapp || "").replace(/^\$/, "").trim();
            const appleC = (s.payApplePayContact || "").trim();
            const totalStr = cartTotal.toFixed(2);
            const note = `${flyer?.title || "Flyer"} order (${cartCount} item${cartCount === 1 ? "" : "s"})`;
            const openPay = (method: string, url: string) => {
              if (!previewMode && flyer) {
                supabase.from("form_submissions").insert([{
                  flyer_id: flyer.id,
                  data: {
                    kind: "cart_payment_intent",
                    payment_method: method,
                    customer: checkoutData,
                    total: cartTotal,
                    currency: cartCurrency,
                    submitted_at: new Date().toISOString(),
                  } as any,
                } as any]);
                logClick(null, "cart_pay:" + method);
              }
              // sms: links must navigate the current window on iOS — window.open opens a blank tab and nothing happens
              if (url.startsWith("sms:") || url.startsWith("tel:") || url.startsWith("mailto:")) {
                window.location.href = url;
              } else {
                window.open(url, "_blank", "noopener,noreferrer");
              }
              setCart([]);
            };
            const hasAny = venmoH || cashH || appleC;
            return (
              <div className="space-y-2">
                {venmoH && (
                  <Button
                    className="w-full justify-start bg-[#3D95CE] hover:bg-[#3D95CE]/90 text-white"
                    onClick={() =>
                      openPay(
                        "venmo",
                        `https://venmo.com/?txn=pay&audience=public&recipients=${encodeURIComponent(venmoH)}&amount=${encodeURIComponent(totalStr)}&note=${encodeURIComponent(note)}`
                      )
                    }
                  >
                    Pay with Venmo · {cartCurrency ? `${cartCurrency} ` : ""}{totalStr}
                  </Button>
                )}
                {cashH && (
                  <Button
                    className="w-full justify-start bg-[#00D632] hover:bg-[#00D632]/90 text-black"
                    onClick={() =>
                      openPay(
                        "cashapp",
                        `https://cash.app/$${encodeURIComponent(cashH)}/${encodeURIComponent(totalStr)}`
                      )
                    }
                  >
                    Pay with Cash App · {cartCurrency ? `${cartCurrency} ` : ""}{totalStr}
                  </Button>
                )}
                {appleC && (
                  <Button
                    className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => {
                      const body = `Sending ${cartCurrency || "$"}${totalStr} for ${note}`;
                      const isEmail = appleC.includes("@");
                      // iOS requires `?&body=` (or `?body=`) — `&body=` without `?` is ignored and Messages won't open
                      const url = isEmail
                        ? `mailto:${appleC}?subject=${encodeURIComponent(note)}&body=${encodeURIComponent(body)}`
                        : `sms:${appleC.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
                      openPay("applecash", url);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Open Messages for Apple Cash · {cartCurrency ? `${cartCurrency} ` : ""}{totalStr}
                  </Button>
                )}
                {appleC && (
                  <p className="text-[11px] text-muted-foreground">
                    On iPhone this opens Messages to the seller with a prefilled note. To send the money, tap the <strong>+</strong> (or Apps) button inside Messages and choose <strong>Apple Cash</strong>.
                  </p>
                )}
                <Button
                  variant={hasAny ? "outline" : "default"}
                  className={hasAny ? "w-full border-red-500 text-red-600 hover:bg-red-50" : "w-full"}
                  onClick={() => {
                    if (!hasAny) {
                      setCheckoutOpen(false);
                      setCheckoutSuccess(false);
                      setCart([]);
                      setPlacedOrderId(null);
                      return;
                    }
                    setPayLaterAccepted(false);
                    setPayLaterConfirmOpen(true);
                  }}
                >
                  {hasAny ? "I'll pay later" : "Done"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
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
// AirMessagesInline — bubble sequence rendered inline over the flyer
// ---------------------------------------------------------------------------

const REACTION_EMOJI: Record<string, string> = {
  heart: "❤️", like: "👍", dislike: "👎", haha: "😂", exclaim: "‼️", question: "❓",
};

function AirMessagesInline({
  action, sourceLayer, scale, canvasW, canvasH, onClose, onRunBubbleAction,
}: {
  action: LayerAction;
  sourceLayer: Layer | null;
  scale: number;
  canvasW: number;
  canvasH: number;
  onClose: () => void;
  onRunBubbleAction: (a: LayerAction) => void;
}) {
  const bubbles: AirMessageBubble[] = action.payload.bubbles || [];
  const stagger = action.payload.bubbleStaggerMs ?? 900;
  const startDelay = Math.max(0, action.payload.bubbleStartDelayMs ?? 0);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    const timers: number[] = [];
    bubbles.forEach((b, i) => {
      const t = (typeof b.delayMs === "number" ? b.delayMs : i * stagger) + 250 + startDelay;
      timers.push(window.setTimeout(() => {
        setVisible((v) => Math.max(v, i + 1));
      }, t));
    });
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.id]);

  // Render in canvas coords; outer wrapper applies CSS scale so geometry
  // matches the editor PC view exactly on every device.
  const rect = sourceLayer
    ? {
        left: sourceLayer.position.x,
        top: sourceLayer.position.y,
        width: sourceLayer.size.width,
        height: sourceLayer.size.height,
      }
    : {
        left: canvasW * 0.08,
        top: canvasH * 0.35,
        width: canvasW * 0.84,
        height: canvasH * 0.30,
      };

  const gap = 10;
  const perBubbleHeight = bubbles.length > 0
    ? Math.max(28, (rect.height - gap * (bubbles.length - 1)) / bubbles.length)
    : 60;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: canvasW * scale,
        height: canvasH * scale,
        pointerEvents: "none",
        zIndex: 30,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: canvasW,
          height: canvasH,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap,
            pointerEvents: "none",
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
                  pointerEvents: hasAction ? "auto" : "none",
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
          <button
            onClick={onClose}
            aria-label="Dismiss messages"
            style={{
              position: "absolute", top: -10, right: -10,
              width: 22, height: 22, borderRadius: "9999px",
              background: "rgba(0,0,0,0.55)", color: "#fff",
              border: "none", cursor: "pointer", fontSize: 14, lineHeight: "20px",
              pointerEvents: "auto",
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            }}
          >×</button>
          <style>{`
            @keyframes airBubbleIn {
              0% { opacity: 0; transform: translateY(12px) scale(0.92); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      </div>
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
