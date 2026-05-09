import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer as KLayer, Rect, Transformer, Ellipse, Group, Text, Image as KonvaImage, Line } from "react-konva";
import useImage from "use-image";
import { useEditorStore } from "@/store/editorStore";
import { LayerRenderer } from "./LayerRenderer";
import { HighlightOverlay } from "./HighlightOverlay";
import { IntroAnimatedGroup, resolveIntro } from "./IntroAnimatedGroup";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import type { AirMessageBubble, Layer as FlyerLayer } from "@/types/flyer";

const ACTION_LABEL: Record<string, string> = {
  open_url: "URL", popup: "Popup", video: "Video", call: "Call",
  sms: "SMS", form: "Form", navigate: "Page", reveal: "Reveal", add_to_calendar: "Calendar",
  buy_ticket: "Ticket", rsvp: "RSVP", checkout: "Checkout", coupon: "Coupon", map: "Map",
};

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

function BubblePreview({ bubble, width, height }: { bubble: AirMessageBubble; width: number; height: number }) {
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

  const rectFill = gradient
    ? { fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: width, y: height }, fillLinearGradientColorStops: [0, bg1, 1, bg2] }
    : { fill: bg1 };

  return (
    <Group listening={false}>
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

function AirMessagesPreview({ layer }: { layer: FlyerLayer }) {
  const bubbles = layer.action?.payload?.bubbles || [];
  if (layer.action?.type !== "air_messages" || bubbles.length === 0) return null;
  const gap = 10;
  const bubbleHeight = Math.max(28, (layer.size.height - gap * (bubbles.length - 1)) / bubbles.length);
  return (
    <Group x={layer.position.x} y={layer.position.y} opacity={0.95} listening={false}>
      {bubbles.map((bubble, index) => (
        <Group key={bubble.id} y={index * (bubbleHeight + gap)}>
          <BubblePreview bubble={bubble} width={layer.size.width} height={bubbleHeight} />
        </Group>
      ))}
    </Group>
  );
}

export function Canvas() {
  const flyer = useEditorStore((s) => s.flyer);
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const zoom = useEditorStore((s) => s.zoom);
  const drawMode = useEditorStore((s) => s.drawMode);
  const setDrawMode = useEditorStore((s) => s.setDrawMode);
  const addHotspotLayer = useEditorStore((s) => s.addHotspotLayer);
  const showHitboxes = useEditorStore((s) => s.showHitboxes);
  const deviceFrame = useEditorStore((s) => s.deviceFrame);
  const pendingCrop = useEditorStore((s) => s.pendingCrop);
  const cropCanvas = useEditorStore((s) => s.cropCanvas);
  const cancelCrop = useEditorStore((s) => s.cancelCrop);
  const introReplayKey = useEditorStore((s) => s.introReplayKey);
  const setStageRef = useEditorStore((s) => s.setStageRef);
  const previewAction = useEditorStore((s) => s.previewAction);

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const cropTrRef = useRef<any>(null);
  const cropRectRef = useRef<any>(null);
  const nodeRefs = useRef<Record<string, any>>({});

  // Register the konva stage with the store so it can be used for thumbnail capture.
  useEffect(() => {
    setStageRef(stageRef.current);
    return () => setStageRef(null);
  }, [setStageRef]);

  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const page = pages.find((p) => p.id === selectedPageId);
  const W = flyer?.settings.width ?? 900;
  const H = flyer?.settings.height ?? 1200;

  // Crop rect state (in canvas coords)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (drawMode === "crop" && pendingCrop) {
      // initialize centered with target aspect, max-fit
      const targetAspect = pendingCrop.width / pendingCrop.height;
      let cw = W;
      let ch = W / targetAspect;
      if (ch > H) { ch = H; cw = H * targetAspect; }
      setCropRect({ x: (W - cw) / 2, y: (H - ch) / 2, width: cw, height: ch });
    } else {
      setCropRect(null);
    }
  }, [drawMode, pendingCrop, W, H]);

  const sortedLayers = useMemo(() => {
    if (!page) return [];
    const layerOrder = new Map(page.layers.map((layer, index) => [layer.id, index]));
    return [...page.layers].sort((a, b) =>
      a.z_index === b.z_index
        ? (layerOrder.get(b.id) ?? 0) - (layerOrder.get(a.id) ?? 0)
        : a.z_index - b.z_index
    );
  }, [page]);

  useEffect(() => {
    if (!trRef.current) return;
    if (selectedLayerId && nodeRefs.current[selectedLayerId] && !drawMode) {
      trRef.current.nodes([nodeRefs.current[selectedLayerId]]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedLayerId, sortedLayers, drawMode]);

  // Attach transformer to crop rect when in crop mode
  useEffect(() => {
    if (drawMode === "crop" && cropTrRef.current && cropRectRef.current) {
      cropTrRef.current.nodes([cropRectRef.current]);
      cropTrRef.current.getLayer()?.batchDraw();
    } else if (cropTrRef.current) {
      cropTrRef.current.nodes([]);
    }
  }, [drawMode, cropRect]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "Escape") {
        if (drawMode === "crop") { cancelCrop(); return; }
        if (drawMode) {
          setDrawMode(null);
          setDrawStart(null);
          setDrawCurrent(null);
          return;
        }
      }
      if (e.key === "Enter" && drawMode === "crop" && cropRect) {
        cropCanvas(cropRect);
        return;
      }
      if (!selectedLayerId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteLayer(selectedLayerId);
      }
      const layer = page?.layers.find((l) => l.id === selectedLayerId);
      if (!layer) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") updateLayer(selectedLayerId, { position: { ...layer.position, x: layer.position.x - step } });
      if (e.key === "ArrowRight") updateLayer(selectedLayerId, { position: { ...layer.position, x: layer.position.x + step } });
      if (e.key === "ArrowUp") updateLayer(selectedLayerId, { position: { ...layer.position, y: layer.position.y - step } });
      if (e.key === "ArrowDown") updateLayer(selectedLayerId, { position: { ...layer.position, y: layer.position.y + step } });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedLayerId, page, deleteLayer, updateLayer, drawMode, setDrawMode, cropRect, cropCanvas, cancelCrop]);

  if (!page || !flyer) return null;

  function getStagePos(e: any): { x: number; y: number } | null {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return { x: pointer.x / zoom, y: pointer.y / zoom };
  }

  const previewRect =
    drawStart && drawCurrent
      ? {
          x: Math.min(drawStart.x, drawCurrent.x),
          y: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null;

  const deviceMaxWidth = deviceFrame === "mobile" ? 420 : deviceFrame === "tablet" ? 820 : Infinity;
  const containerStyle: React.CSSProperties =
    deviceFrame !== "desktop"
      ? { maxWidth: deviceMaxWidth, border: "10px solid hsl(var(--border))", borderRadius: deviceFrame === "mobile" ? 32 : 16 }
      : {};

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-muted/40 p-8">
      {(drawMode === "hotspot" || drawMode === "hotspot-ellipse") && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-elegant backdrop-blur">
          <span className="font-medium">
            Drag on the canvas to draw a {drawMode === "hotspot-ellipse" ? "circle" : "rectangle"} hotspot
          </span>
          <span className="text-muted-foreground">— Esc to cancel</span>
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => { setDrawMode(null); setDrawStart(null); setDrawCurrent(null); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {drawMode === "crop" && cropRect && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-elegant backdrop-blur">
          <span className="font-medium">Adjust the crop region</span>
          <span className="text-muted-foreground">— Enter to apply, Esc to cancel</span>
          <Button size="sm" className="h-7" onClick={() => cropCanvas(cropRect)}>
            <Check className="mr-1 h-3.5 w-3.5" /> Apply crop
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelCrop}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="shadow-elegant" style={containerStyle}>
        <div
          style={{
            position: "relative",
            width: W * zoom,
            height: H * zoom,
            background: page.background.color || "#fff",
            cursor: drawMode === "hotspot" || drawMode === "hotspot-ellipse" ? "crosshair" : "default",
          }}
        >
          <Stage
            ref={stageRef}
            width={W * zoom}
            height={H * zoom}
            scaleX={zoom}
            scaleY={zoom}
            onMouseDown={(e) => {
              if (drawMode === "hotspot" || drawMode === "hotspot-ellipse") {
                const p = getStagePos(e);
                if (p) { setDrawStart(p); setDrawCurrent(p); }
                return;
              }
              if (drawMode === "crop") return;
              if (e.target === e.target.getStage()) selectLayer(null);
            }}
            onMouseMove={(e) => {
              if ((drawMode === "hotspot" || drawMode === "hotspot-ellipse") && drawStart) {
                const p = getStagePos(e);
                if (p) setDrawCurrent(p);
              }
            }}
            onMouseUp={() => {
              if ((drawMode === "hotspot" || drawMode === "hotspot-ellipse") && drawStart && drawCurrent) {
                const w = Math.abs(drawCurrent.x - drawStart.x);
                const h = Math.abs(drawCurrent.y - drawStart.y);
                if (w >= 8 && h >= 8) {
                  addHotspotLayer({
                    x: Math.min(drawStart.x, drawCurrent.x),
                    y: Math.min(drawStart.y, drawCurrent.y),
                    width: w, height: h,
                  }, drawMode === "hotspot-ellipse" ? "ellipse" : "rect");
                } else { setDrawMode(null); }
                setDrawStart(null); setDrawCurrent(null);
              }
            }}
            onTouchStart={(e) => {
              if (drawMode === "hotspot" || drawMode === "hotspot-ellipse") {
                const p = getStagePos(e);
                if (p) { setDrawStart(p); setDrawCurrent(p); }
                return;
              }
              if (drawMode === "crop") return;
              if (e.target === e.target.getStage()) selectLayer(null);
            }}
            onTouchMove={(e) => {
              if ((drawMode === "hotspot" || drawMode === "hotspot-ellipse") && drawStart) {
                const p = getStagePos(e);
                if (p) setDrawCurrent(p);
              }
            }}
            onTouchEnd={() => {
              if ((drawMode === "hotspot" || drawMode === "hotspot-ellipse") && drawStart && drawCurrent) {
                const w = Math.abs(drawCurrent.x - drawStart.x);
                const h = Math.abs(drawCurrent.y - drawStart.y);
                if (w >= 8 && h >= 8) {
                  addHotspotLayer({
                    x: Math.min(drawStart.x, drawCurrent.x),
                    y: Math.min(drawStart.y, drawCurrent.y),
                    width: w, height: h,
                  }, drawMode === "hotspot-ellipse" ? "ellipse" : "rect");
                } else { setDrawMode(null); }
                setDrawStart(null); setDrawCurrent(null);
              }
            }}
          >
            <KLayer>
              <Rect x={0} y={0} width={W} height={H} fill={page.background.color || "#fff"} listening={false} />
              {sortedLayers.map((l, idx) => {
                const pageCfg = resolveIntro(page.intro);
                // Per-layer intro overrides the page-level intro entirely.
                const cfg = l.intro ? resolveIntro(l.intro) : pageCfg;
                const delay = l.intro
                  ? cfg.delayMs
                  : cfg.delayMs + (cfg.stagger ? idx * cfg.staggerStepMs : 0);
                const cx = l.position.x + l.size.width / 2;
                const cy = l.position.y + l.size.height / 2;
                const effectiveAction = previewAction && previewAction.layerId === l.id ? previewAction.action : l.action;
                const h = effectiveAction?.highlight;
                const showHighlight =
                  (flyer.settings.highlightsEnabled ?? true) &&
                  !!effectiveAction &&
                  h?.enabled !== false &&
                  (h?.style ?? "pulse") !== "none";
                const highlightShape: "rect" | "ellipse" =
                  l.type === "hotspot" && l.content.hotspotShape === "ellipse" ? "ellipse" : "rect";
                const renderLayer = effectiveAction === l.action ? l : { ...l, action: effectiveAction };
                return (
                  <IntroAnimatedGroup
                    key={l.id}
                    preset={cfg.preset}
                    durationMs={cfg.durationMs}
                    delayMs={delay}
                    cx={cx}
                    cy={cy}
                    introKey={`${page.id}:${l.id}:${cfg.preset}:${introReplayKey}`}
                  >
                    <LayerRenderer
                      layer={l}
                      isSelected={selectedLayerId === l.id}
                      draggable={!drawMode}
                      onSelect={() => !drawMode && selectLayer(l.id)}
                      onChange={(patch) => updateLayer(l.id, patch)}
                      refSetter={(node) => {
                        if (node) nodeRefs.current[l.id] = node;
                        else delete nodeRefs.current[l.id];
                      }}
                    />
                    {effectiveAction?.type === "air_messages" && <AirMessagesPreview layer={renderLayer} />}
                    {showHighlight && <HighlightOverlay layer={renderLayer} shape={highlightShape} />}
                  </IntroAnimatedGroup>
                );
              })}
              {previewRect && (
                drawMode === "hotspot-ellipse" ? (
                  <Ellipse
                    x={previewRect.x + previewRect.width / 2}
                    y={previewRect.y + previewRect.height / 2}
                    radiusX={previewRect.width / 2}
                    radiusY={previewRect.height / 2}
                    fill="rgba(124,58,237,0.12)" stroke="#7c3aed" strokeWidth={1.5}
                    dash={[6, 4]} listening={false}
                  />
                ) : (
                  <Rect
                    x={previewRect.x} y={previewRect.y}
                    width={previewRect.width} height={previewRect.height}
                    fill="rgba(124,58,237,0.12)" stroke="#7c3aed" strokeWidth={1.5}
                    dash={[6, 4]} listening={false}
                  />
                )
              )}
              <Transformer
                ref={trRef}
                rotateEnabled
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
              />
            </KLayer>

            {/* Hitbox overlay */}
            {showHitboxes && (
              <KLayer listening={false}>
                {sortedLayers
                  .filter((l) => l.action || l.type === "hotspot")
                  .map((l) => {
                    const labelText = l.action ? ACTION_LABEL[l.action.type] || l.action.type : "Hotspot";
                    const isEllipse = l.type === "hotspot" && l.content.hotspotShape === "ellipse";
                    return (
                      <Group key={"hb-" + l.id}>
                        {isEllipse ? (
                          <Ellipse
                            x={l.position.x + l.size.width / 2}
                            y={l.position.y + l.size.height / 2}
                            radiusX={l.size.width / 2}
                            radiusY={l.size.height / 2}
                            stroke="#7c3aed"
                            strokeWidth={2}
                            dash={[8, 5]}
                            fill="rgba(124,58,237,0.10)"
                          />
                        ) : (
                          <Rect
                            x={l.position.x} y={l.position.y}
                            width={l.size.width} height={l.size.height}
                            stroke="#7c3aed" strokeWidth={2}
                            dash={[8, 5]} fill="rgba(124,58,237,0.10)"
                          />
                        )}
                        <Group x={l.position.x + 4} y={l.position.y + 4}>
                          <Rect width={Math.max(36, labelText.length * 7 + 12)} height={18} fill="#7c3aed" cornerRadius={4} />
                          <Text text={labelText} x={6} y={3} fontSize={11} fill="#fff" fontStyle="600" />
                        </Group>
                      </Group>
                    );
                  })}
              </KLayer>
            )}

            {/* Crop overlay */}
            {drawMode === "crop" && cropRect && (
              <KLayer>
                {/* Dark mask outside crop */}
                <Rect x={0} y={0} width={W} height={cropRect.y} fill="rgba(0,0,0,0.5)" listening={false} />
                <Rect x={0} y={cropRect.y + cropRect.height} width={W} height={Math.max(0, H - cropRect.y - cropRect.height)} fill="rgba(0,0,0,0.5)" listening={false} />
                <Rect x={0} y={cropRect.y} width={cropRect.x} height={cropRect.height} fill="rgba(0,0,0,0.5)" listening={false} />
                <Rect x={cropRect.x + cropRect.width} y={cropRect.y} width={Math.max(0, W - cropRect.x - cropRect.width)} height={cropRect.height} fill="rgba(0,0,0,0.5)" listening={false} />
                <Rect
                  ref={cropRectRef}
                  x={cropRect.x} y={cropRect.y}
                  width={cropRect.width} height={cropRect.height}
                  stroke="#7c3aed" strokeWidth={2} dash={[8, 5]}
                  fill="rgba(124,58,237,0.05)"
                  draggable
                  onDragMove={(e) => {
                    const node = e.target;
                    setCropRect({
                      x: Math.max(0, Math.min(W - cropRect.width, node.x())),
                      y: Math.max(0, Math.min(H - cropRect.height, node.y())),
                      width: cropRect.width, height: cropRect.height,
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const sx = node.scaleX();
                    const sy = node.scaleY();
                    node.scaleX(1); node.scaleY(1);
                    setCropRect({
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(40, node.width() * sx),
                      height: Math.max(40, node.height() * sy),
                    });
                  }}
                />
                <Transformer
                  ref={cropTrRef}
                  rotateEnabled={false}
                  boundBoxFunc={(oldBox, newBox) => (newBox.width < 40 || newBox.height < 40 ? oldBox : newBox)}
                />
              </KLayer>
            )}
          </Stage>

        </div>
      </div>
    </div>
  );
}
