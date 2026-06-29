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

/** Inline audio player used inside popup dialogs. Plays while popup is open. */
function PopupAudioPlayer({
  url, autoplay, loop, defaultVolume, showControl,
}: { url: string; autoplay: boolean; loop: boolean; defaultVolume: number; showControl: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(Math.max(0, Math.min(1, defaultVolume)));
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.volume = volume;
  }, [volume]);
  useEffect(() => {
    const a = ref.current;
    if (!a || !autoplay) return;
    a.play().catch(() => { /* autoplay blocked — controls will let user start */ });
  }, [autoplay, url]);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
      <audio
        ref={ref}
        src={url}
        loop={loop}
        controls={showControl}
        autoPlay={autoplay}
        className="h-8 flex-1 min-w-0"
        style={{ maxWidth: "100%" }}
      />
      {showControl && (
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="w-20 accent-primary"
          aria-label="Volume"
        />
      )}
    </div>
  );
}

/** Coarse device classification for analytics breakdowns. */
function getViewerDevice(): "mobile" | "tablet" | "desktop" {
  try {
    const ua = navigator.userAgent || "";
    if (/iPad|Tablet|PlayBook|Silk|(?=.*\bAndroid\b)(?!.*\bMobile\b)/i.test(ua)) return "tablet";
    if (/Mobi|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
    return "desktop";
  } catch { return "desktop"; }
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

import { useParams, useSearchParams } from "react-router-dom";
import { Stage, Layer as KLayer, Rect, Circle, Ellipse, Line, Text, Image as KonvaImage, Group } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import * as LucideIcons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { supabase } from "@/integrations/supabase/client";
import { Flyer, FlyerPage, Layer, LayerAction, AirMessageBubble } from "@/types/flyer";
import { IntroAnimatedGroup, resolveIntro } from "@/components/editor/IntroAnimatedGroup";
import { AirBubble } from "@/components/AirBubble";
import { Loader2, Copy, Check, MessageSquare, Share2, ChevronLeft, ChevronRight } from "lucide-react";
import { buildSocialShareUrl } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import AppointmentBookingDialog from "@/components/viewer/AppointmentBookingDialog";
import NewInteractionDialogs, { MenuCartUI } from "@/components/viewer/NewInteractionDialogs";
import { useMenuCart } from "@/store/menuCartStore";
import { SocialSlideout } from "@/components/viewer/SocialSlideout";
import { toast } from "sonner";
import { getCurrentTrafficSource } from "@/lib/trafficSource";
import { OrderStatusTracker, OrderTrackFloatingButton } from "@/components/viewer/OrderStatusTracker";
import { saveOrderTrack } from "@/lib/customerOrderStatus";
import { MiniAdBanner } from "@/components/viewer/MiniAdBanner";


// Highlight ring shown around tappable layers in the viewer.
function PulseHighlight({ layer, shape }: { layer: Layer; shape: "rect" | "ellipse" }) {
  const ref = useRef<any>(null);
  const ping1Ref = useRef<any>(null);
  const ping2Ref = useRef<any>(null);
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
        node.opacity(baseOpacity * (0.55 + 0.45 * e));
        node.strokeWidth(thickness + 2 * e);
        // Radar ping rings expanding outward
        const cx = layer.position.x + layer.size.width / 2;
        const cy = layer.position.y + layer.size.height / 2;
        const animatePing = (n: any, phase: number) => {
          if (!n) return;
          const tp = ((frame.time + phase) % period) / period;
          const scale = 1 + tp * 0.45;
          n.scale({ x: scale, y: scale });
          n.position({ x: cx, y: cy });
          n.opacity(baseOpacity * (1 - tp));
          n.strokeWidth(Math.max(1, thickness * (1 - tp * 0.5)));
        };
        animatePing(ping1Ref.current, 0);
        animatePing(ping2Ref.current, period / 2);
      } else {
        // glow: steady stroke, pulsing shadow
        node.shadowOpacity(0.3 + 0.6 * e);
        node.shadowBlur(8 + 16 * e);
      }
    }, node.getLayer());
    anim.start();
    return () => { anim.stop(); };
  }, [style, thickness, baseOpacity, color, layer.position.x, layer.position.y, layer.size.width, layer.size.height]);

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
  // Radar ping rings (only for default "pulse" style) — centered on the layer
  // and scaled by the animation. Use offset so scaling expands outward from center.
  const showPings = style === "pulse";
  const cx = layer.position.x + layer.size.width / 2;
  const cy = layer.position.y + layer.size.height / 2;
  const renderPings = () => {
    if (!showPings) return null;
    if (shape === "ellipse") {
      return (
        <>
          <Ellipse
            ref={ping1Ref}
            x={cx} y={cy}
            radiusX={layer.size.width / 2}
            radiusY={layer.size.height / 2}
            stroke={color}
            strokeWidth={thickness}
            opacity={baseOpacity}
            listening={false}
          />
          <Ellipse
            ref={ping2Ref}
            x={cx} y={cy}
            radiusX={layer.size.width / 2}
            radiusY={layer.size.height / 2}
            stroke={color}
            strokeWidth={thickness}
            opacity={0}
            listening={false}
          />
        </>
      );
    }
    return (
      <>
        <Rect
          ref={ping1Ref}
          x={cx} y={cy}
          width={layer.size.width}
          height={layer.size.height}
          offsetX={layer.size.width / 2}
          offsetY={layer.size.height / 2}
          cornerRadius={layer.style.cornerRadius || 8}
          stroke={color}
          strokeWidth={thickness}
          opacity={baseOpacity}
          listening={false}
        />
        <Rect
          ref={ping2Ref}
          x={cx} y={cy}
          width={layer.size.width}
          height={layer.size.height}
          offsetX={layer.size.width / 2}
          offsetY={layer.size.height / 2}
          cornerRadius={layer.style.cornerRadius || 8}
          stroke={color}
          strokeWidth={thickness}
          opacity={0}
          listening={false}
        />
      </>
    );
  };

  if (shape === "ellipse") {
    return (
      <>
        {renderPings()}
        <Ellipse
          {...common}
          radiusX={layer.size.width / 2}
          radiusY={layer.size.height / 2}
          offsetX={-layer.size.width / 2}
          offsetY={-layer.size.height / 2}
        />
      </>
    );
  }
  return (
    <>
      {renderPings()}
      <Rect {...common} cornerRadius={layer.style.cornerRadius || 8} />
    </>
  );
}

/**
 * One-shot click confirmation ring — expands and fades from the click point,
 * then auto-removes after ~600ms.
 */
function ClickPing({ x, y, color = "#7c3aed", onDone }: { x: number; y: number; color?: string; onDone: () => void }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const duration = 600;
    const start = performance.now();
    const anim = new Konva.Animation(() => {
      const elapsed = performance.now() - start;
      const p = Math.min(1, elapsed / duration);
      node.radius(20 + p * 80);
      node.opacity(1 - p);
      node.strokeWidth(4 * (1 - p) + 1);
      if (p >= 1) {
        anim.stop();
        onDone();
      }
    }, node.getLayer());
    anim.start();
    return () => { anim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Circle
      ref={ref}
      x={x}
      y={y}
      radius={20}
      stroke={color}
      strokeWidth={4}
      opacity={1}
      shadowColor={color}
      shadowBlur={12}
      shadowOpacity={0.6}
      listening={false}
    />
  );
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

function useKonvaDisplayImage(src?: string) {
  const safeSrc = src || "";
  const [anonymousImg, anonymousStatus] = useImage(safeSrc, "anonymous");
  const [plainImg, setPlainImg] = useState<HTMLImageElement | undefined>();

  useEffect(() => {
    if (!safeSrc || anonymousStatus !== "failed") {
      setPlainImg(undefined);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setPlainImg(img); };
    img.onerror = () => { if (!cancelled) setPlainImg(undefined); };
    img.src = safeSrc;
    return () => { cancelled = true; };
  }, [safeSrc, anonymousStatus]);

  return anonymousImg || plainImg;
}

function ImageNode({ layer, props, showHoverOutline }: { layer: Layer; props: any; showHoverOutline?: boolean }) {
  const img = useKonvaDisplayImage(layer.content.src);
  const [hovered, setHovered] = useState(false);

  if (!showHoverOutline) {
    return <KonvaImage {...props} image={img} cornerRadius={layer.style.cornerRadius} />;
  }

  const { onMouseEnter, onMouseLeave, width, height, ...rest } = props;

  return (
    <Group
      {...rest}
      width={width}
      height={height}
      onMouseEnter={(e: any) => {
        onMouseEnter?.(e);
        setHovered(true);
      }}
      onMouseLeave={(e: any) => {
        onMouseLeave?.(e);
        setHovered(false);
      }}
    >
      <KonvaImage image={img} width={width} height={height} cornerRadius={layer.style.cornerRadius} />
      {hovered && (
        <Rect
          width={width}
          height={height}
          cornerRadius={layer.style.cornerRadius}
          stroke="#7c3aed"
          strokeWidth={2}
          listening={false}
        />
      )}
    </Group>
  );
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
      return <ImageNode key={l.id} layer={l} props={common} showHoverOutline={!!l.content.extractedFrom && hasAction} />;
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
  const [searchParams] = useSearchParams();
  const startPageParam = searchParams.get("page");
  const openPageParam = searchParams.get("open");
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
  const [formLayerId, setFormLayerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [coupon, setCoupon] = useState<LayerAction | null>(null);
  const [gallery, setGallery] = useState<LayerAction | null>(null);
  const [realtorGallery, setRealtorGallery] = useState<LayerAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<LayerAction | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomPopup, setZoomPopup] = useState<LayerAction | null>(null);
  const [popupImageReady, setPopupImageReady] = useState(false);
  const [zoomImageReady, setZoomImageReady] = useState(false);
  useEffect(() => { setPopupImageReady(false); setPopupQty(1); }, [popup?.id, popup?.payload?.mediaUrl]);
  useEffect(() => { setZoomImageReady(false); }, [zoomImage]);
  const [enlarged, setEnlarged] = useState(false);
  const [clickPings, setClickPings] = useState<Array<{ id: string; x: number; y: number; color: string }>>([]);
  const [airMessages, setAirMessages] = useState<Array<{ action: LayerAction; layer: Layer | null }>>([]);
  const [poll, setPoll] = useState<LayerAction | null>(null);
  const [subscribeAction, setSubscribeAction] = useState<LayerAction | null>(null);
  const [subscribeData, setSubscribeData] = useState<{ name: string; email: string; phone: string }>({ name: "", email: "", phone: "" });
  const [appointmentAction, setAppointmentAction] = useState<{ action: LayerAction; layer: Layer | null } | null>(null);
  const [newInteractionAction, setNewInteractionAction] = useState<LayerAction | null>(null);
  const [productGrid, setProductGrid] = useState<LayerAction | null>(null);
  const [productDetail, setProductDetail] = useState<{ action: LayerAction; product: any } | null>(null);
  const [pdSize, setPdSize] = useState<string>("");
  const [pdQty, setPdQty] = useState<number>(1);
  const sessionId = useMemo(() => getPollSessionId(), []);
  const [subscribing, setSubscribing] = useState(false);
  // Shopping cart for buy_product actions with productCartEnabled
  type CartItem = {
    id: string; // stable per product+size combo
    name: string;
    price: number; // numeric, 0 if not parseable
    priceDisplay: string;
    currency: string;
    image?: string;
    qty: number;
    size?: string;
  };
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [popupQty, setPopupQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [orderTrackOpen, setOrderTrackOpen] = useState(false);
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
  function addProductToCart(prod: any, size: string | undefined, qty: number) {
    const priceNum = Number(String(prod.price ?? "").replace(/[^0-9.]/g, "")) || 0;
    const addQty = Math.max(1, Math.floor(qty || 1));
    const lineId = `${prod.id}${size ? `|${size}` : ""}`;
    setCart((prev) => {
      const existing = prev.find((it) => it.id === lineId);
      if (existing) return prev.map((it) => (it.id === lineId ? { ...it, qty: it.qty + addQty } : it));
      return [
        ...prev,
        {
          id: lineId,
          name: prod.name || "Product",
          price: priceNum,
          priceDisplay: prod.price || "",
          currency: prod.currency || "",
          image: prod.imageUrl,
          qty: addQty,
          size,
        },
      ];
    });
    toast.success(`Added ${addQty} × "${prod.name || "Product"}"${size ? ` (${size})` : ""} to cart`);
  }
  const cartCount = cart.reduce((n, it) => n + it.qty, 0);
  const cartTotal = cart.reduce((n, it) => n + it.price * it.qty, 0);
  const cartCurrency = cart.find((it) => it.currency)?.currency || "";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const [audioInfo, setAudioInfo] = useState<{ url: string; loop: boolean } | null>(null);
  const introPlayedRef = useRef(false);
  const [introNeedsTap, setIntroNeedsTap] = useState(false);
  // Background audio (separate from intro audio)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgVolume, setBgVolume] = useState<number>(0.5);
  const [bgNeedsTap, setBgNeedsTap] = useState(false);
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
      // Auto-unpublish expired event flyers on access (safety net for cron).
      if (!previewMode && (f as any).category === "event" && (f as any).auto_unpublish_at && new Date((f as any).auto_unpublish_at) <= new Date()) {
        await supabase.from("flyers").update({ status: "draft" }).eq("id", f.id);
        setFlyer(null);
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
      // Honor ?page=<id> to deep-link to a specific page. Otherwise, if any
      // page is configured as a tap-anywhere landing (linkPageId set), skip
      // it on initial load and open the linked target directly — the landing
      // exists only to drive the social share preview.
      // Explicit ?open=<id> wins — used by share links so humans bypass the
      // landing page even though the crawler-facing ?page=<landingId> is kept
      // for the social preview image.
      if (openPageParam) {
        const openIdx = mapped.findIndex((p) => p.id === openPageParam);
        if (openIdx >= 0) {
          setPageIndex(openIdx);
        } else if (startPageParam) {
          const idx = mapped.findIndex((p) => p.id === startPageParam);
          if (idx >= 0) setPageIndex(idx);
        }
      } else if (startPageParam) {
        const idx = mapped.findIndex((p) => p.id === startPageParam);
        if (idx >= 0) {
          // If the deep-linked page is a tap-anywhere landing (exists only
          // to drive the social share preview), forward straight to its
          // linked target so humans land on the actual flyer.
          const linkedId = mapped[idx].background?.linkPageId;
          const linkedIdx = linkedId ? mapped.findIndex((p) => p.id === linkedId) : -1;
          setPageIndex(linkedIdx >= 0 ? linkedIdx : idx);
        }
      } else {
        const landing = mapped.find((p) => p.background?.linkPageId);
        if (landing?.background?.linkPageId) {
          const idx = mapped.findIndex((p) => p.id === landing.background!.linkPageId);
          if (idx >= 0) setPageIndex(idx);
        }
      }
      setLoading(false);

      // analytics: view (skip in preview mode)
      if (!previewMode) {
        const sid = getViewerSessionId();
        const ts = getCurrentTrafficSource();
        const { error: trackErr } = await supabase
          .from("analytics_events")
          .insert([{ flyer_id: f.id, event_type: "view", session_id: sid, metadata: { referrer: ts.referrer, source: ts.source, utm: ts.utm, device: getViewerDevice() } } as any]);
        if (trackErr) console.warn("[analytics] view insert failed", trackErr);
      }
    })();
  }, [slug, flyerId, previewMode]);

  // Dynamically set document title, meta tags, canonical link, and JSON-LD
  // structured data so each flyer has its own SEO footprint for Google and
  // social previews (iMessage, etc. — anything that executes JS).
  useEffect(() => {
    if (!flyer) return;
    const baseTitle = flyer.title || "Flyer";
    const title = `${baseTitle} — Interactive Flyer`;
    const cat = (flyer as any).category;
    const description =
      cat === "event"
        ? `${baseTitle} — tap, RSVP, and explore this interactive event flyer.`
        : `${baseTitle} — interactive flyer with tappable links, polls, and bookings.`;
    const image =
      (flyer as any).thumbnail_url ||
      `${window.location.origin}/og.png`;
    const url = window.location.href;
    const canonicalUrl = slug
      ? `${window.location.origin}/f/${slug}`
      : url.split("?")[0];

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
    setMeta(`meta[property="og:url"]`, "property", "og:url", canonicalUrl);
    setMeta(`meta[property="og:type"]`, "property", "og:type", cat === "event" ? "article" : "website");
    setMeta(`meta[name="description"]`, "name", "description", description);
    setMeta(`meta[name="robots"]`, "name", "robots", "index,follow,max-image-preview:large");
    setMeta(`meta[name="twitter:card"]`, "name", "twitter:card", "summary_large_image");
    setMeta(`meta[name="twitter:title"]`, "name", "twitter:title", title);
    setMeta(`meta[name="twitter:description"]`, "name", "twitter:description", description);
    setMeta(`meta[name="twitter:image"]`, "name", "twitter:image", image);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    const ldId = "flyer-jsonld";
    let ld = document.getElementById(ldId) as HTMLScriptElement | null;
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.id = ldId;
      document.head.appendChild(ld);
    }
    const ldData: Record<string, any> = cat === "event"
      ? {
          "@context": "https://schema.org",
          "@type": "Event",
          name: baseTitle,
          description,
          image: [image],
          url: canonicalUrl,
          ...((flyer as any).event_date ? { startDate: (flyer as any).event_date } : {}),
          eventStatus: "https://schema.org/EventScheduled",
        }
      : {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: baseTitle,
          description,
          image: [image],
          url: canonicalUrl,
        };
    ld.textContent = JSON.stringify(ldData);

    return () => {
      document.title = prevTitle;
    };
  }, [flyer, slug]);

  // Per-flyer Web App Manifest + iOS home-screen meta. Each flyer becomes
  // individually installable: "Add to Home Screen" creates an icon that
  // opens THIS flyer fullscreen (not the Tap That Flyer brand).
  useEffect(() => {
    if (!flyer || previewMode) return;
    const origin = window.location.origin;
    const startPath = slug ? `/f/${slug}` : window.location.pathname;
    const title = flyer.title || "Flyer";
    const shortName = title.length > 12 ? title.slice(0, 12) : title;
    const themeColor =
      (flyer.settings as any)?.background ||
      (flyer.pages?.[0]?.background?.color) ||
      "#0a0a0a";

    const manifest = {
      name: title,
      short_name: shortName,
      start_url: startPath,
      scope: startPath,
      id: startPath,
      display: "standalone",
      orientation: "portrait",
      background_color: themeColor,
      theme_color: themeColor,
      icons: [
        { src: `${origin}/flyer-icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${origin}/flyer-icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `${origin}/flyer-icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const manifestUrl = URL.createObjectURL(blob);

    // Remove any pre-existing manifest link so ours wins.
    const prevManifests = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'));
    const prevManifestHrefs = prevManifests.map((l) => l.getAttribute("href"));
    prevManifests.forEach((l) => l.remove());

    const manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = manifestUrl;
    document.head.appendChild(manifestLink);

    // Theme color
    let themeMeta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = themeMeta?.getAttribute("content") ?? null;
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", themeColor);

    // iOS standalone meta + apple-touch-icon
    const setMetaNamed = (name: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const prev = tag?.getAttribute("content") ?? null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
      return prev;
    };
    const prevCapable = setMetaNamed("apple-mobile-web-app-capable", "yes");
    const prevMobileCap = setMetaNamed("mobile-web-app-capable", "yes");
    const prevStatusBar = setMetaNamed("apple-mobile-web-app-status-bar-style", "black-translucent");
    const prevAppTitle = setMetaNamed("apple-mobile-web-app-title", title);

    const prevApple = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]'));
    const prevAppleHrefs = prevApple.map((l) => l.getAttribute("href"));
    prevApple.forEach((l) => l.remove());
    const appleLink = document.createElement("link");
    appleLink.setAttribute("rel", "apple-touch-icon");
    appleLink.setAttribute("href", `${origin}/apple-touch-icon.png`);
    document.head.appendChild(appleLink);

    return () => {
      manifestLink.remove();
      URL.revokeObjectURL(manifestUrl);
      // Restore prior manifest link(s) so other routes are unaffected.
      prevManifestHrefs.forEach((href) => {
        if (!href) return;
        const l = document.createElement("link");
        l.rel = "manifest";
        l.href = href;
        document.head.appendChild(l);
      });
      appleLink.remove();
      prevAppleHrefs.forEach((href) => {
        if (!href) return;
        const l = document.createElement("link");
        l.setAttribute("rel", "apple-touch-icon");
        l.setAttribute("href", href);
        document.head.appendChild(l);
      });
      if (prevTheme !== null) themeMeta!.setAttribute("content", prevTheme);
      else themeMeta?.remove();
      const restoreOrRemove = (name: string, prev: string | null) => {
        const tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
        if (!tag) return;
        if (prev !== null) tag.setAttribute("content", prev);
        else tag.remove();
      };
      restoreOrRemove("apple-mobile-web-app-capable", prevCapable);
      restoreOrRemove("mobile-web-app-capable", prevMobileCap);
      restoreOrRemove("apple-mobile-web-app-status-bar-style", prevStatusBar);
      restoreOrRemove("apple-mobile-web-app-title", prevAppTitle);
    };
  }, [flyer, slug, previewMode]);


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
      metadata: { ...metadata, action_type: type, device: getViewerDevice() } as any,
    });
  }

  // Best-effort beacon on tab close so a quick visit still records a view.
  useEffect(() => {
    if (!flyer || previewMode) return;
    const onHide = () => {
      try {
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;
        const apikey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const ts = getCurrentTrafficSource();
        const body = JSON.stringify({
          flyer_id: flyer.id,
          event_type: "view",
          session_id: getViewerSessionId(),
          metadata: { beacon: true, referrer: ts.referrer, source: ts.source, utm: ts.utm, device: getViewerDevice() },
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

  function triggerClickPing(x: number, y: number, color?: string) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setClickPings((prev) => [...prev, { id, x, y, color: color || "#7c3aed" }]);
  }

  function runAction(layer: Layer) {
    if (!layer.action) return;
    const cx = layer.position.x + layer.size.width / 2;
    const cy = layer.position.y + layer.size.height / 2;
    triggerClickPing(cx, cy, layer.action.highlight?.color);
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
        setFormLayerId(layer?.id ?? null);
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
        setFormLayerId(layer?.id ?? null);
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
      case "gallery":
        setGallery(a);
        break;
      case "realtor_gallery":
        setRealtorGallery(a);
        break;
      case "product_grid":
        setProductGrid(a);
        setProductDetail(null);
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
      case "survey":
      case "testimonial":
      case "reserve_table":
      case "schedule_consultation":
      case "show_menu":
      case "join_challenge":
      case "business_rating":
      case "novel":
        setNewInteractionAction(a);
        break;
      case "menu_add_item": {
        const item = (a.payload as any).menuItem;
        if (item) {
          useMenuCart.getState().add(item);
          useMenuCart.getState().setOpen(true, "upsell");
        }
        break;
      }
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
      layer_id: formLayerId,
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
    const vol = Math.max(0, Math.min(1, flyer.settings?.introAudioVolume ?? 1));
    const el = new Audio(url);
    el.loop = loop;
    el.volume = vol;
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
  }, [flyer?.id, flyer?.settings?.introAudioUrl, flyer?.settings?.introAudioLoop, flyer?.settings?.introAudioVolume]);

  // Background audio — independent looping soundtrack.
  useEffect(() => {
    if (!flyer) return;
    const url = flyer.settings?.bgAudioUrl;
    if (!url) {
      if (bgAudioRef.current) {
        try { bgAudioRef.current.pause(); } catch { /* noop */ }
        bgAudioRef.current = null;
      }
      setBgPlaying(false);
      setBgNeedsTap(false);
      return;
    }
    const loop = flyer.settings?.bgAudioLoop ?? true;
    const vol = Math.max(0, Math.min(1, flyer.settings?.bgAudioVolume ?? 0.5));
    const autoplay = flyer.settings?.bgAudioAutoplay ?? true;
    setBgVolume(vol);

    const el = new Audio(url);
    el.loop = loop;
    el.volume = vol;
    el.onplay = () => { el.volume = vol; setBgPlaying(true); };
    el.onpause = () => setBgPlaying(false);
    el.onended = () => { if (!loop) setBgPlaying(false); };
    el.onloadedmetadata = () => { el.volume = vol; };
    bgAudioRef.current = el;

    if (!autoplay) return () => { try { el.pause(); } catch { /* noop */ } };

    (async () => {
      try {
        el.volume = vol;
        await el.play();
        setBgNeedsTap(false);
      } catch {
        setBgNeedsTap(true);
        const startFromTap = () => {
          try {
            const p = el.play();
            if (p && typeof p.then === "function") {
              p.then(() => setBgNeedsTap(false)).catch(() => { /* noop */ });
            } else {
              setBgNeedsTap(false);
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
    })();

    return () => {
      try { el.pause(); } catch { /* noop */ }
      bgAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyer?.id, flyer?.settings?.bgAudioUrl, flyer?.settings?.bgAudioLoop, flyer?.settings?.bgAudioAutoplay]);

  // Apply default volume changes without re-creating the audio element.
  useEffect(() => {
    const v = Math.max(0, Math.min(1, flyer?.settings?.bgAudioVolume ?? 0.5));
    setBgVolume(v);
    if (bgAudioRef.current) bgAudioRef.current.volume = v;
  }, [flyer?.settings?.bgAudioVolume]);


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

  // Auto-advance: cycle to the next page on a configurable timer (ms).
  // Paused while any popup/dialog/form/video/coupon/gallery overlay is open.
  useEffect(() => {
    if (loading || !flyer || pages.length < 2) return;
    const enabled = (flyer.settings as any)?.autoAdvanceEnabled ?? false;
    const ms = Number((flyer.settings as any)?.autoAdvanceMs ?? 0);
    const loop = (flyer.settings as any)?.autoAdvanceLoop ?? true;
    if (!enabled || !ms || ms < 100) return;
    if (popup || video || formAction || coupon || gallery || confirmAction || zoomImage || zoomPopup) return;
    const t = window.setTimeout(() => {
      setPageIndex((i) => {
        const next = i + 1;
        if (next >= pages.length) return loop ? 0 : i;
        return next;
      });
    }, ms);
    return () => window.clearTimeout(t);
  }, [pageIndex, loading, flyer, pages.length, popup, video, formAction, coupon, gallery, confirmAction, zoomImage, zoomPopup]);

  // Keyboard navigation: ArrowLeft/ArrowRight to change pages.
  useEffect(() => {
    if (pages.length < 2) return;
    const blocked = popup || video || formAction || coupon || gallery || confirmAction || zoomImage || zoomPopup;
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") setPageIndex((i) => Math.min(pages.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setPageIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length, popup, video, formAction, coupon, gallery, confirmAction, zoomImage, zoomPopup]);



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

  // Parameter-first rendering: allow using this page as a dynamic template
  // via URL query params (?title=...&image=...&description=...). When params
  // are provided, we render them directly and bypass the DB lookup state.
  const urlParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const paramTitle = urlParams.get("title");
  const paramImage = urlParams.get("image");
  const paramDescription = urlParams.get("description");
  const hasParams = !!(paramTitle || paramImage || paramDescription);

  if (hasParams && (!flyer || pages.length === 0)) {
    if (typeof document !== "undefined" && paramTitle) {
      document.title = paramTitle;
    }
    return (
      <div className="flex min-h-screen flex-col items-center bg-background">
        {paramTitle && (
          <h1 className="font-display text-3xl font-bold text-foreground py-6 px-4 text-center">
            {paramTitle}
          </h1>
        )}
        {paramImage && (
          <img
            src={paramImage}
            alt={paramTitle || "Flyer"}
            className="w-full h-auto block"
          />
        )}
        {paramDescription && (
          <p className="text-muted-foreground py-6 px-4 text-center max-w-2xl">
            {paramDescription}
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="font-display text-lg font-semibold text-foreground animate-pulse">
          We Are Loading Your Experience
        </div>
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
  const W = page.background?.size?.width ?? flyer.settings.width;
  const H = page.background?.size?.height ?? flyer.settings.height;
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

  // Fill the viewport WIDTH edge-to-edge — preserves aspect ratio, allows
  // vertical scrolling if the flyer is taller than the screen.
  const vw = typeof window !== "undefined" ? window.innerWidth : W;
  const vh = typeof window !== "undefined" ? window.innerHeight : H;
  // Pages configured as full-page links (e.g. landing → flyer) should fill the
  // entire viewport edge-to-edge rather than letterbox, so the recipient sees
  // the same framing as the editor canvas.
  const isLinkedPage = !!page.background?.linkPageId;
  const fitScale = Math.min(vw / W, vh / H);
  // Enlarged: fill the longer viewport edge so user can scroll/pan to inspect details.
  // Multiplier gives extra zoom on top of fit-to-screen.
  const enlargedScale = Math.max(vw / W, vh / H) * 1.6;
  const scale = enlarged ? enlargedScale : fitScale;

  return (
    <div
      className={`min-h-screen ${isLinkedPage ? "overflow-hidden" : "overflow-auto"}`}
      style={{ background: page.background.color || "#fff", touchAction: enlarged ? "pan-x pan-y pinch-zoom" : "pinch-zoom" }}
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
      <div ref={stageWrapRef} style={{ position: "relative", width: W * scale, height: H * scale, margin: "0 auto", background: page.background.color || "#fff" }}>
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
                      loop={cfg.loop}
                      loopDelayMs={cfg.loopDelayMs}
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
          {/* One-shot click confirmation rings */}
          {imagesReady && clickPings.length > 0 && (
            <KLayer listening={false}>
              {clickPings.map((p) => (
                <ClickPing
                  key={p.id}
                  x={p.x}
                  y={p.y}
                  color={p.color}
                  onDone={() => setClickPings((prev) => prev.filter((q) => q.id !== p.id))}
                />
              ))}
            </KLayer>
          )}
          {imagesReady && previewMode && showHitboxes && (
            <KLayer listening={false}>
              {page.layers
                .filter((l) => (l.action || l.type === "hotspot") && !hiddenIds.has(l.id))
                .map((l) => {
                  const isEllipse = l.type === "hotspot" && l.content.hotspotShape === "ellipse";
                  const color = l.action?.highlight?.color ?? "#7c3aed";
                  return isEllipse ? (
                    <Ellipse
                      key={"hb-" + l.id}
                      x={l.position.x + l.size.width / 2}
                      y={l.position.y + l.size.height / 2}
                      radiusX={l.size.width / 2}
                      radiusY={l.size.height / 2}
                      stroke={color} strokeWidth={2} dash={[8, 5]}
                      fill={`${color}26`}
                    />
                  ) : (
                    <Rect
                      key={"hb-" + l.id}
                      x={l.position.x} y={l.position.y}
                      width={l.size.width} height={l.size.height}
                      stroke={color} strokeWidth={2} dash={[8, 5]}
                      fill={`${color}26`}
                    />
                  );
                })}
            </KLayer>
          )}
        </Stage>
        {/* Air-message bubbles are rendered inside the Konva Stage so they
            respect per-layer z_index ordering. */}
        {/* When a page is configured to act as a link (e.g. landing → flyer),
            an absolutely positioned overlay above the stage captures any tap
            and navigates to the linked page. */}
        {(() => {
          const linkId = page.background?.linkPageId;
          if (!linkId) return null;
          const targetIdx = pages.findIndex((p) => p.id === linkId);
          if (targetIdx < 0) return null;
          return (
            <button
              type="button"
              aria-label={`Open ${pages[targetIdx].name}`}
              onClick={() => { window.setTimeout(() => setPageIndex(targetIdx), 1); }}
              style={{
                position: "absolute",
                inset: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                zIndex: 5,
              }}
            />
          );
        })()}
        {!isLinkedPage && <SocialSlideout settings={flyer.settings.social} />}
        {!isLinkedPage && !previewMode && (
          <button
            type="button"
            aria-label="Share this flyer"
            onClick={async () => {
              const shareSlug = (flyer as any).public_slug || slug;
              const url = shareSlug ? buildSocialShareUrl(shareSlug) : window.location.href;
              const title = flyer.title || "Check this out";
              try {
                if (navigator.share) {
                  await navigator.share({ title, url });
                  return;
                }
              } catch (err: any) {
                if (err?.name === "AbortError") return;
              }
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Share link copied");
              } catch {
                toast.error("Could not copy link");
              }
            }}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 31,
              width: 40,
              height: 40,
              borderRadius: 9999,
              border: "none",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            }}
          >
            <Share2 size={18} />
          </button>
        )}
        {(() => {
          // Landing pages (those configured to redirect to another page) should
          // not appear in the visitor-facing page count or navigation.
          const navPages = pages.filter((p) => !p.background?.linkPageId);
          const navIdx = navPages.findIndex((p) => p.id === pages[pageIndex]?.id);
          const visibleIdx = navIdx >= 0 ? navIdx : 0;
          const total = navPages.length;
          const goTo = (nextNavIdx: number) => {
            const clamped = Math.max(0, Math.min(total - 1, nextNavIdx));
            const target = navPages[clamped];
            if (!target) return;
            const realIdx = pages.findIndex((p) => p.id === target.id);
            if (realIdx >= 0) setPageIndex(realIdx);
          };
          if (isLinkedPage || total <= 1 || popup || video || formAction || coupon || gallery || confirmAction || zoomImage || zoomPopup || productGrid) return null;
          return (
            <div
              style={{
                position: "fixed",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 31,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 9999,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
              }}
            >
              <button
                type="button"
                aria-label="Previous page"
                disabled={visibleIdx === 0}
                onClick={() => goTo(visibleIdx - 1)}
                style={{
                  width: 36, height: 36, borderRadius: 9999, border: "none",
                  background: "transparent", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: visibleIdx === 0 ? "not-allowed" : "pointer",
                  opacity: visibleIdx === 0 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "center" }}>
                {visibleIdx + 1} / {total}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={visibleIdx >= total - 1}
                onClick={() => goTo(visibleIdx + 1)}
                style={{
                  width: 36, height: 36, borderRadius: 9999, border: "none",
                  background: "transparent", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: visibleIdx >= total - 1 ? "not-allowed" : "pointer",
                  opacity: visibleIdx >= total - 1 ? 0.4 : 1,
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          );
        })()}

      </div>


      {/* Popup (also used for buy_ticket) */}
      <Dialog open={!!popup} onOpenChange={(v) => !v && setPopup(null)}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto overscroll-contain"
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
            <DialogTitle style={{ color: "inherit", fontSize: popup?.type === "popup" && popup?.payload.popupTitleSize ? `${popup.payload.popupTitleSize}px` : undefined }}>{popup?.payload.title || (popup?.type === "buy_ticket" ? "Get your ticket" : popup?.type === "buy_product" ? (popup.payload.productName || "Buy product") : "Info")}</DialogTitle>
            {popup?.payload.body && (
              <div
                className="whitespace-pre-wrap break-words text-left"
                style={{
                  color: "inherit",
                  fontSize:
                    popup?.type === "popup" && popup?.payload.popupBodySize
                      ? `${popup.payload.popupBodySize}px`
                      : undefined,
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
              >
                {popup.payload.body}
              </div>
            )}
          </DialogHeader>
          {popup?.payload.popupAudioUrl && (
            <PopupAudioPlayer
              key={popup.id}
              url={popup.payload.popupAudioUrl}
              autoplay={popup.payload.popupAudioAutoplay ?? true}
              loop={popup.payload.popupAudioLoop ?? false}
              defaultVolume={popup.payload.popupAudioVolume ?? 0.8}
              showControl={popup.payload.popupAudioShowControl ?? true}
            />
          )}
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
          className="max-w-none w-screen h-screen sm:rounded-none p-0 bg-black/95 border-none shadow-none flex items-center justify-center top-0 left-0 translate-x-0 translate-y-0"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {zoomImage && (
            <div className="relative w-screen h-screen flex items-center justify-center">
              <img
                src={zoomImage}
                alt="Zoomed"
                className="block max-h-screen max-w-screen w-auto h-auto object-contain"
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
          {(flyer?.settings?.introAudioShowControl ?? true) && audioInfo.url === flyer?.settings?.introAudioUrl && (
            <div className="flex items-center gap-1.5">
              <Slider
                className="w-20"
                value={[Math.round(((audioRef.current?.volume ?? flyer?.settings?.introAudioVolume ?? 1)) * 100)]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => {
                  if (audioRef.current) audioRef.current.volume = (v[0] ?? 100) / 100;
                  // force re-render
                  setAudioInfo((s) => (s ? { ...s } : s));
                }}
              />
            </div>
          )}
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
      {/* Background audio mini-player */}
      {flyer?.settings?.bgAudioUrl && (flyer.settings.bgAudioShowControl ?? true) && (
        <div
          className="fixed left-3 z-50 flex items-center gap-2 rounded-full border border-border bg-card/95 px-2.5 py-1 shadow-elegant backdrop-blur"
          style={{ top: audioInfo ? 44 : 12 }}
        >
          <button
            type="button"
            aria-label={bgPlaying ? "Pause background audio" : "Play background audio"}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted"
            onClick={() => {
              const el = bgAudioRef.current;
              if (!el) return;
              if (bgPlaying) {
                el.pause();
              } else {
                el.play().then(() => setBgNeedsTap(false)).catch(() => { /* noop */ });
              }
            }}
          >
            <span className="text-[12px] leading-none">{bgPlaying ? "⏸" : "▶"}</span>
          </button>
          <span className="text-[11px] font-medium">BG</span>
          <Slider
            className="w-20"
            value={[Math.round(bgVolume * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => {
              const nv = (v[0] ?? 50) / 100;
              setBgVolume(nv);
              if (bgAudioRef.current) bgAudioRef.current.volume = nv;
            }}
          />
          {bgNeedsTap && !bgPlaying && (
            <span className="text-[10px] text-muted-foreground">tap ▶</span>
          )}
        </div>
      )}

      <Dialog open={!!formAction} onOpenChange={(v) => { if (!v) { setFormAction(null); setFormLayerId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formAction?.payload.title || (formAction?.type === "rsvp" ? "RSVP" : "Get in touch")}
            </DialogTitle>
            {formAction?.payload.body && <DialogDescription className="whitespace-pre-wrap">{formAction.payload.body}</DialogDescription>}
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

      {/* New interaction dialogs (survey, testimonial, reserve, consult, menu, challenge, rating) */}
      <NewInteractionDialogs
        action={newInteractionAction}
        flyerId={flyer?.id || null}
        sessionId={sessionId}
        onClose={() => setNewInteractionAction(null)}
      />

      {/* Scanned-menu cart (shared across all pages of this flyer) */}
      {flyer && (flyer.settings as any)?.menuCatalog && (
        <ScannedMenuCart flyerId={flyer.id} catalog={(flyer.settings as any).menuCatalog} />
      )}

      {/* Subscribe dialog */}
      <Dialog open={!!subscribeAction} onOpenChange={(v) => !v && setSubscribeAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subscribeAction?.payload.subscribeTitle || "Join our list"}</DialogTitle>
            {subscribeAction?.payload.subscribeBody && (
              <DialogDescription className="whitespace-pre-wrap">{subscribeAction.payload.subscribeBody}</DialogDescription>
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
            {confirmAction?.payload.body && <DialogDescription className="whitespace-pre-wrap">{confirmAction.payload.body}</DialogDescription>}
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

      {/* Photo gallery */}
      <GalleryDialog
        action={gallery}
        onClose={() => setGallery(null)}
        onZoom={(url) => setZoomImage(url)}
        onRunAction={(a) => { setGallery(null); executeAction(a, null); }}
      />

      {/* Realtor listing gallery */}
      <RealtorGalleryDialog
        action={realtorGallery}
        onClose={() => setRealtorGallery(null)}
        onZoom={(url) => setZoomImage(url)}
      />

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

      {/* Multi-product shop (product_grid) */}
      <Dialog
        open={!!productGrid}
        onOpenChange={(o) => {
          if (!o) { setProductGrid(null); setProductDetail(null); }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LucideIcons.ShoppingBag className="h-5 w-5" />
              {productGrid?.payload.productGridTitle || "Shop"}
            </DialogTitle>
            {!productDetail && (
              <DialogDescription>
                {(productGrid?.payload.products?.length || 0)} product{(productGrid?.payload.products?.length || 0) === 1 ? "" : "s"}
              </DialogDescription>
            )}
          </DialogHeader>

          {!productDetail && productGrid && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(productGrid.payload.products || []).map((prod: any) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    setProductDetail({ action: productGrid, product: prod });
                    setPdSize(prod.sizesEnabled && prod.sizes?.length ? prod.sizes[0] : "");
                    setPdQty(1);
                  }}
                  className="text-left rounded-lg border border-border bg-card hover:border-primary transition overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt={prod.name} className="h-full w-full object-cover" />
                    ) : (
                      <LucideIcons.Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-sm font-medium truncate">{prod.name || "Untitled"}</div>
                    {prod.price && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {prod.currency ? `${prod.currency} ` : ""}{prod.price}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {productDetail && (() => {
            const prod = productDetail.product;
            const priceNum = Number(String(prod.price ?? "").replace(/[^0-9.]/g, "")) || 0;
            const cur = prod.currency ? `${prod.currency} ` : "";
            return (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setProductDetail(null)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <LucideIcons.ChevronLeft className="h-3.5 w-3.5" /> Back to shop
                </button>
                {prod.imageUrl && (
                  <img src={prod.imageUrl} alt={prod.name} className="w-full max-h-72 object-contain rounded-md bg-muted" />
                )}
                <div>
                  <div className="text-lg font-semibold">{prod.name}</div>
                  {prod.price && (
                    <div className="text-base text-foreground mt-1">{cur}{prod.price}</div>
                  )}
                </div>
                {prod.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prod.description}</p>
                )}
                {prod.sizesEnabled && prod.sizes?.length > 0 && (
                  <div>
                    <Label className="text-xs">Size</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {prod.sizes.map((s: string) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPdSize(s)}
                          className={`px-3 py-1.5 text-sm rounded border ${pdSize === s ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:bg-muted"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Quantity</span>
                  <div className="inline-flex items-center gap-2">
                    <button type="button" className="h-8 w-8 rounded-md border border-border hover:bg-muted disabled:opacity-50" disabled={pdQty <= 1} onClick={() => setPdQty((q) => Math.max(1, q - 1))}>−</button>
                    <input type="number" min={1} max={999} value={pdQty} onChange={(e) => { const n = parseInt(e.target.value, 10); setPdQty(Number.isFinite(n) && n > 0 ? Math.min(999, n) : 1); }} className="h-8 w-14 rounded-md border border-border bg-background text-center text-sm" />
                    <button type="button" className="h-8 w-8 rounded-md border border-border hover:bg-muted" onClick={() => setPdQty((q) => Math.min(999, q + 1))}>+</button>
                  </div>
                </div>
                {priceNum > 0 && (
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="text-base font-semibold">{cur}{(priceNum * pdQty).toFixed(2)}</span>
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={prod.sizesEnabled && prod.sizes?.length > 0 && !pdSize}
                  onClick={() => {
                    logClick(null, "product_grid_add_to_cart");
                    addProductToCart(prod, pdSize || undefined, pdQty);
                    setProductDetail(null);
                    setProductGrid(null);
                    setCartOpen(true);
                  }}
                >
                  <LucideIcons.ShoppingCart className="h-4 w-4 mr-2" />
                  Add to cart
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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
                    <div className="text-sm font-medium truncate">{it.name}{it.size ? <span className="ml-1 text-xs text-muted-foreground">· {it.size}</span> : null}</div>
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
                if ((inserted as any)?.id && flyer) {
                  saveOrderTrack(flyer.id, {
                    orderId: (inserted as any).id,
                    kind: "cart",
                    email: checkoutData.email,
                    phone: checkoutData.phone || undefined,
                    customerName: checkoutData.name || undefined,
                    itemCount: cart.reduce((n: number, l: any) => n + (l.qty || 1), 0),
                    placedAt: new Date().toISOString(),
                  });
                }
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
                {placedOrderId && (
                  <Button variant="secondary" className="w-full" onClick={() => setOrderTrackOpen(true)}>
                    Track order status
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Pay Later acceptance — buyer must agree before order is placed on hold */}
      <Dialog open={payLaterConfirmOpen} onOpenChange={(o) => !o && !payLaterSubmitting && setPayLaterConfirmOpen(false)}>
        <DialogContent className="max-w-md border-2 border-red-500">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠ Your order will be placed on hold</DialogTitle>
            <DialogDescription>
              By choosing to pay later, you acknowledge that your order <strong>will not be processed,
              fulfilled, or shipped</strong> until the seller receives full payment. The seller may
              contact you by phone, text, or email to collect payment.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 rounded border border-border p-3 text-sm cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-red-600"
              checked={payLaterAccepted}
              onChange={(e) => setPayLaterAccepted(e.target.checked)}
            />
            <span>
              I understand my order will remain <strong>on hold</strong> until payment is received,
              and I agree to be contacted by the seller to arrange payment.
            </span>
          </label>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPayLaterConfirmOpen(false)}
              disabled={payLaterSubmitting}
            >
              Go back
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={!payLaterAccepted || payLaterSubmitting}
              onClick={async () => {
                if (!flyer) return;
                setPayLaterSubmitting(true);
                if (!previewMode) {
                  await supabase.from("form_submissions").insert([{
                    flyer_id: flyer.id,
                    data: {
                      kind: "cart_pay_later",
                      order_id: placedOrderId,
                      customer: checkoutData,
                      total: cartTotal,
                      currency: cartCurrency,
                      buyer_accepted_hold: true,
                      accepted_at: new Date().toISOString(),
                      submitted_at: new Date().toISOString(),
                    } as any,
                  } as any]);
                  logClick(null, "cart_pay:later");
                }
                setPayLaterSubmitting(false);
                setPayLaterConfirmOpen(false);
                setCheckoutOpen(false);
                setCheckoutSuccess(false);
                setCart([]);
                setPlacedOrderId(null);
                toast.success("Order placed on hold — the seller will reach out to collect payment.");
              }}
            >
              {payLaterSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "I agree & pay later"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {flyer && (
        <OrderStatusTracker
          flyerId={flyer.id}
          open={orderTrackOpen}
          onOpenChange={setOrderTrackOpen}
        />
      )}
      {flyer && !previewMode && (
        <OrderTrackFloatingButton
          flyerId={flyer.id}
          onOpen={() => setOrderTrackOpen(true)}
        />
      )}
      {flyer && <MiniAdBanner flyerId={flyer.id} previewMode={previewMode} />}
    </div>
  );
}

function GalleryDialog({
  action, onClose, onZoom, onRunAction,
}: { action: LayerAction | null; onClose: () => void; onZoom: (url: string) => void; onRunAction: (a: LayerAction) => void }) {
  const open = !!action;
  const images = action?.payload.galleryImages || [];
  const title = action?.payload.galleryTitle || "Photo gallery";
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos in this gallery.</p>
        ) : (
          <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {images.map((im) => (
              <button
                key={im.id}
                type="button"
                onClick={() => (im.action ? onRunAction(im.action) : onZoom(im.url))}
                className="group overflow-hidden rounded border border-border bg-muted/30 text-left"
              >
                <img
                  src={im.url}
                  alt={im.caption || ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
                {im.caption && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">{im.caption}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RealtorGalleryDialog({
  action, onClose, onZoom,
}: { action: LayerAction | null; onClose: () => void; onZoom: (url: string) => void }) {
  const open = !!action;
  const listingId = action?.payload.realtorListingId;
  const title = action?.payload.realtorGalleryTitle || "Property photos";
  const [photos, setPhotos] = useState<{ id: string; url: string; staged_url: string | null; caption: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !listingId) return;
    setLoading(true);
    setPhotos([]);
    (async () => {
      const { data } = await supabase
        .from("listing_photos" as any)
        .select("id, url, staged_url, caption, position")
        .eq("flyer_id", listingId)
        .order("position", { ascending: true });
      setPhotos(((data as any[]) ?? []).map((p) => ({ id: p.id, url: p.url, staged_url: p.staged_url, caption: p.caption })));
      setLoading(false);
    })();
  }, [open, listingId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading photos…</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos available for this listing yet.</p>
        ) : (
          <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {photos.map((im) => (
              <button
                key={im.id}
                type="button"
                onClick={() => onZoom(im.url)}
                className="group relative overflow-hidden rounded border border-border bg-muted/30 text-left"
              >
                <img
                  src={im.url}
                  alt={im.caption || ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
                {im.staged_url && (
                  <span className="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Staged
                  </span>
                )}
                {im.caption && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">{im.caption}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
          {p.body && <DialogDescription className="whitespace-pre-wrap">{p.body}</DialogDescription>}
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

function ScannedMenuCart({ flyerId, catalog }: { flyerId: string; catalog: any }) {
  const open = useMenuCart((s) => s.open);
  const count = useMenuCart((s) => s.cart.reduce((n, l) => n + l.qty, 0));
  const total = useMenuCart((s) => s.cart.reduce((n, l) => n + (l.item.price || 0) * l.qty, 0));
  const setOpen = useMenuCart((s) => s.setOpen);
  const currency = catalog?.currency || "$";
  return (
    <>
      <MenuCartUI
        flyerId={flyerId}
        sections={catalog?.sections || []}
        currency={currency}
        title={catalog?.title || "Your order"}
        checkoutMode={catalog?.checkoutMode || "order_only"}
        paymentLink={catalog?.paymentLink}
      />
      {!open && count > 0 && (
        <button
          onClick={() => setOpen(true, "checkout")}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold shadow-lg"
        >
          Cart · {count} · {currency}{total.toFixed(2)}
        </button>
      )}
    </>
  );
}
