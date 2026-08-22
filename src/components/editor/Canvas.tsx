import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer as KLayer, Rect, Transformer, Ellipse, Group, Text, Image as KonvaImage, Line, Circle } from "react-konva";
import useImage from "use-image";
import { useEditorStore } from "@/store/editorStore";
import { LayerRenderer } from "./LayerRenderer";
import { HighlightOverlay } from "./HighlightOverlay";
import { IntroAnimatedGroup, resolveIntro } from "./IntroAnimatedGroup";
import { Button } from "@/components/ui/button";
import {
  X, Check, Loader2, Trash2, Copy as CopyIcon, ChevronsUp, ChevronsDown,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  MoveHorizontal, MoveVertical,
} from "lucide-react";
import type { AirMessageBubble, Layer as FlyerLayer } from "@/types/flyer";
import { SocialSlideout } from "@/components/viewer/SocialSlideout";
import { useObjectExtract } from "@/hooks/useObjectExtract";
import { bboxToCanvasRect, polygonToCanvasPoints } from "@/lib/subjectDetect";

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
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const selectLayers = useEditorStore((s) => s.selectLayers);
  const toggleLayerSelection = useEditorStore((s) => s.toggleLayerSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const selectAllLayers = useEditorStore((s) => s.selectAllLayers);
  const applyLayerPatches = useEditorStore((s) => s.applyLayerPatches);
  const moveLayersBy = useEditorStore((s) => s.moveLayersBy);
  const deleteLayers = useEditorStore((s) => s.deleteLayers);
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers);
  const alignLayers = useEditorStore((s) => s.alignLayers);
  const distributeLayers = useEditorStore((s) => s.distributeLayers);
  const orderLayersBulk = useEditorStore((s) => s.orderLayersBulk);
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
  const extractSourceLayerId = useEditorStore((s) => s.extractSourceLayerId);
  const subjectDetections = useEditorStore((s) => s.subjectDetections);
  const dismissSubjectDetection = useEditorStore((s) => s.dismissSubjectDetection);
  const cancelObjectExtract = useEditorStore((s) => s.cancelObjectExtract);
  const introReplayKey = useEditorStore((s) => s.introReplayKey);
  const setStageRef = useEditorStore((s) => s.setStageRef);
  const previewAction = useEditorStore((s) => s.previewAction);
  const { extractFromRect, extractFromSubject, extracting } = useObjectExtract();

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
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [hoveredDetectionId, setHoveredDetectionId] = useState<string | null>(null);
  // Rubber-band (marquee) selection state, in canvas coordinates.
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number; additive: boolean } | null>(null);

  const selectionRef = useRef<string[]>(selectedLayerIds);
  selectionRef.current = selectedLayerIds;
  // Group-drag bookkeeping: origin of the dragged node + starting positions of the rest.
  const dragOrigin = useRef<{ id: string; x: number; y: number } | null>(null);
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({});
  // Buffers per-node changes during a multi-select drag/transform into one history entry.
  const patchBuffer = useRef<Record<string, any>>({});
  const flushTimer = useRef<any>(null);

  function handleLayerChange(id: string, patch: any) {
    const sel = selectionRef.current;
    if (sel.length > 1 && sel.includes(id)) {
      patchBuffer.current[id] = { ...(patchBuffer.current[id] || {}), ...patch };
      // End of a group drag: carry the same delta over to the other selected layers.
      const origin = dragOrigin.current;
      if (origin && origin.id === id && patch.position) {
        const dx = patch.position.x - origin.x;
        const dy = patch.position.y - origin.y;
        for (const [otherId, start] of Object.entries(dragStartPositions.current)) {
          patchBuffer.current[otherId] = {
            ...(patchBuffer.current[otherId] || {}),
            position: { x: start.x + dx, y: start.y + dy },
          };
        }
        dragOrigin.current = null;
        dragStartPositions.current = {};
      }
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        const buf = patchBuffer.current;
        patchBuffer.current = {};
        applyLayerPatches(buf);
      }, 0);
      return;
    }
    updateLayer(id, patch);
  }


  function handleDragStartNode(id: string, node: any) {
    const sel = selectionRef.current;
    if (sel.length < 2 || !sel.includes(id)) return;
    dragOrigin.current = { id, x: node.x(), y: node.y() };
    const starts: Record<string, { x: number; y: number }> = {};
    for (const otherId of sel) {
      const n = nodeRefs.current[otherId];
      if (n && otherId !== id) starts[otherId] = { x: n.x(), y: n.y() };
    }
    dragStartPositions.current = starts;
  }

  function handleDragMoveNode(id: string, node: any) {
    const origin = dragOrigin.current;
    if (!origin || origin.id !== id) return;
    const dx = node.x() - origin.x;
    const dy = node.y() - origin.y;
    for (const [otherId, start] of Object.entries(dragStartPositions.current)) {
      const n = nodeRefs.current[otherId];
      if (n) n.position({ x: start.x + dx, y: start.y + dy });
    }
    node.getLayer()?.batchDraw();
  }

  function handleLayerClick(id: string, evt: any) {
    const native = evt?.evt;
    if (native && (native.shiftKey || native.ctrlKey || native.metaKey)) {
      toggleLayerSelection(id);
      return;
    }
    if (selectionRef.current.length > 1 && selectionRef.current.includes(id)) return;
    selectLayer(id);
  }


  const page = pages.find((p) => p.id === selectedPageId);
  const W = page?.background?.size?.width ?? flyer?.settings.width ?? 900;
  const H = page?.background?.size?.height ?? flyer?.settings.height ?? 1200;
  const activeSubjectDetections = subjectDetections.filter((d) => !d.extracted && !d.dismissed);
  const extractSourceLayer = page?.layers.find((l) => l.id === extractSourceLayerId);
  const isRectDrawMode = drawMode === "hotspot" || drawMode === "extract-rect";

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
    if (drawMode) {
      setHoveredLayerId(null);
      setHoveredDetectionId(null);
    }
  }, [drawMode]);

  async function finishRectSelection(rect: { x: number; y: number; width: number; height: number }) {
    if (drawMode === "extract-rect") {
      await extractFromRect(rect);
    } else if (drawMode === "hotspot") {
      addHotspotLayer(rect, "rect");
    }
    setDrawStart(null);
    setDrawCurrent(null);
  }

  useEffect(() => {
    if (!trRef.current) return;
    const ids = selectedLayerIds.length ? selectedLayerIds : selectedLayerId ? [selectedLayerId] : [];
    const nodes = drawMode ? [] : ids.map((id) => nodeRefs.current[id]).filter(Boolean);
    trRef.current.nodes(nodes);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedLayerId, selectedLayerIds, sortedLayers, drawMode]);


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
        if (drawMode === "extract-rect" || drawMode === "extract-auto") {
          cancelObjectExtract();
          setDrawStart(null);
          setDrawCurrent(null);
          return;
        }
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
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllLayers();
        return;
      }
      const sel = selectedLayerIds.length ? selectedLayerIds : selectedLayerId ? [selectedLayerId] : [];
      if (!sel.length) return;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateLayers(sel);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (sel.length > 1) deleteLayers(sel);
        else deleteLayer(sel[0]);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = deltas[e.key];
      if (d) {
        e.preventDefault();
        moveLayersBy(sel, d[0], d[1]);
      }
    }
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [selectedLayerId, selectedLayerIds, page, deleteLayer, deleteLayers, duplicateLayers, moveLayersBy, selectAllLayers, updateLayer, drawMode, setDrawMode, cropRect, cropCanvas, cancelCrop, cancelObjectExtract]);

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
      {drawMode === "extract-auto" && (
        <div className="absolute left-1/2 top-3 z-20 flex max-w-lg -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-elegant backdrop-blur">
          {extracting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="font-medium">Extracting subject…</span>
            </>
          ) : (
            <>
              <span className="font-medium">Click a subject outline to extract</span>
              <span className="text-muted-foreground">
                {activeSubjectDetections.length} remaining — use ✕ to dismiss unwanted
              </span>
            </>
          )}
          <span className="text-muted-foreground">— Esc to exit</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={extracting}
            onClick={cancelObjectExtract}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {drawMode === "extract-rect" && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-elegant backdrop-blur">
          {extracting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="font-medium">Extracting object…</span>
            </>
          ) : (
            <>
              <span className="font-medium">Drag over the object to extract as a new layer</span>
              <span className="text-muted-foreground">— original image stays untouched</span>
            </>
          )}
          <span className="text-muted-foreground">— Esc to cancel</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={extracting}
            onClick={() => { cancelObjectExtract(); setDrawStart(null); setDrawCurrent(null); }}
          >
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
      {selectedLayerIds.length > 1 && !drawMode && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 flex-wrap items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-elegant backdrop-blur">
          <span className="mr-1 font-medium">{selectedLayerIds.length} selected</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Align left" onClick={() => alignLayers(selectedLayerIds, "left")}>
            <AlignStartVertical className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Align horizontal centers" onClick={() => alignLayers(selectedLayerIds, "hcenter")}>
            <AlignCenterVertical className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Align right" onClick={() => alignLayers(selectedLayerIds, "right")}>
            <AlignEndVertical className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Align top" onClick={() => alignLayers(selectedLayerIds, "top")}>
            <AlignStartHorizontal className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Align vertical centers" onClick={() => alignLayers(selectedLayerIds, "vcenter")}>
            <AlignCenterHorizontal className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Align bottom" onClick={() => alignLayers(selectedLayerIds, "bottom")}>
            <AlignEndHorizontal className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Distribute horizontally" disabled={selectedLayerIds.length < 3} onClick={() => distributeLayers(selectedLayerIds, "h")}>
            <MoveHorizontal className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Distribute vertically" disabled={selectedLayerIds.length < 3} onClick={() => distributeLayers(selectedLayerIds, "v")}>
            <MoveVertical className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Bring to front" onClick={() => orderLayersBulk(selectedLayerIds, "front")}>
            <ChevronsUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Send to back" onClick={() => orderLayersBulk(selectedLayerIds, "back")}>
            <ChevronsDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate" onClick={() => duplicateLayers(selectedLayerIds)}>
            <CopyIcon className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => deleteLayers(selectedLayerIds)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Clear selection" onClick={clearSelection}>
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
            backgroundImage: page.background.image ? `url(${page.background.image})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            cursor: isRectDrawMode || drawMode === "hotspot-ellipse" || drawMode === "extract-auto" ? "crosshair" : "default",
          }}
        >
          <Stage
            ref={stageRef}
            width={W * zoom}
            height={H * zoom}
            scaleX={zoom}
            scaleY={zoom}
            onMouseDown={(e) => {
              if (drawMode === "extract-rect" && !extracting) {
                const p = getStagePos(e);
                if (p) { setDrawStart(p); setDrawCurrent(p); }
                return;
              }
              if (drawMode === "hotspot" || drawMode === "hotspot-ellipse") {
                const p = getStagePos(e);
                if (p) { setDrawStart(p); setDrawCurrent(p); }
                return;
              }
              if (drawMode === "crop") return;
              if (e.target === e.target.getStage()) {
                const p = getStagePos(e);
                const additive = !!(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
                if (p) setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y, additive });
                if (!additive) selectLayer(null);
                setHoveredLayerId(null);
              }
            }}
            onMouseMove={(e) => {
              if ((isRectDrawMode || drawMode === "hotspot-ellipse") && drawStart && !extracting) {
                const p = getStagePos(e);
                if (p) setDrawCurrent(p);
                return;
              }
              if (marquee) {
                const p = getStagePos(e);
                if (p) setMarquee((m) => (m ? { ...m, x2: p.x, y2: p.y } : m));
              }
            }}
            onMouseUp={() => {
              if (marquee) {
                const box = {
                  x: Math.min(marquee.x1, marquee.x2),
                  y: Math.min(marquee.y1, marquee.y2),
                  w: Math.abs(marquee.x2 - marquee.x1),
                  h: Math.abs(marquee.y2 - marquee.y1),
                };
                const additive = marquee.additive;
                setMarquee(null);
                if (box.w >= 5 && box.h >= 5) {
                  const hits = (page?.layers ?? [])
                    .filter(
                      (l) =>
                        l.position.x < box.x + box.w &&
                        l.position.x + l.size.width > box.x &&
                        l.position.y < box.y + box.h &&
                        l.position.y + l.size.height > box.y
                    )
                    .map((l) => l.id);
                  const next = additive
                    ? Array.from(new Set([...selectionRef.current, ...hits]))
                    : hits;
                  selectLayers(next);
                  return;
                }
              }

              if (drawMode === "extract-rect" && drawStart && drawCurrent && !extracting) {
                const w = Math.abs(drawCurrent.x - drawStart.x);
                const h = Math.abs(drawCurrent.y - drawStart.y);
                if (w >= 8 && h >= 8) {
                  finishRectSelection({
                    x: Math.min(drawStart.x, drawCurrent.x),
                    y: Math.min(drawStart.y, drawCurrent.y),
                    width: w,
                    height: h,
                  });
                } else {
                  setDrawStart(null);
                  setDrawCurrent(null);
                }
                return;
              }
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
              if (drawMode === "extract-rect" && !extracting) {
                const p = getStagePos(e);
                if (p) { setDrawStart(p); setDrawCurrent(p); }
                return;
              }
              if (drawMode === "hotspot" || drawMode === "hotspot-ellipse") {
                const p = getStagePos(e);
                if (p) { setDrawStart(p); setDrawCurrent(p); }
                return;
              }
              if (drawMode === "crop") return;
              if (e.target === e.target.getStage()) {
                selectLayer(null);
                setHoveredLayerId(null);
              }
            }}
            onTouchMove={(e) => {
              if ((isRectDrawMode || drawMode === "hotspot-ellipse") && drawStart && !extracting) {
                const p = getStagePos(e);
                if (p) setDrawCurrent(p);
              }
            }}
            onTouchEnd={() => {
              if (drawMode === "extract-rect" && drawStart && drawCurrent && !extracting) {
                const w = Math.abs(drawCurrent.x - drawStart.x);
                const h = Math.abs(drawCurrent.y - drawStart.y);
                if (w >= 8 && h >= 8) {
                  finishRectSelection({
                    x: Math.min(drawStart.x, drawCurrent.x),
                    y: Math.min(drawStart.y, drawCurrent.y),
                    width: w,
                    height: h,
                  });
                } else {
                  setDrawStart(null);
                  setDrawCurrent(null);
                }
                return;
              }
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
              {!page.background.image && (
                <Rect x={0} y={0} width={W} height={H} fill={page.background.color || "#fff"} listening={false} />
              )}
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
                    loop={cfg.loop}
                    loopDelayMs={cfg.loopDelayMs}
                    cx={cx}
                    cy={cy}
                    introKey={`${page.id}:${l.id}:${cfg.preset}:${introReplayKey}`}
                  >
                    <LayerRenderer
                      layer={l}
                      isSelected={selectedLayerIds.includes(l.id) || selectedLayerId === l.id}
                      draggable={!drawMode}
                      onSelect={(evt) => !drawMode && handleLayerClick(l.id, evt)}
                      onChange={(patch) => handleLayerChange(l.id, patch)}
                      onDragStartNode={handleDragStartNode}
                      onDragMoveNode={handleDragMoveNode}
                      onHoverStart={() => !drawMode && setHoveredLayerId(l.id)}
                      onHoverEnd={() => setHoveredLayerId((id) => (id === l.id ? null : id))}
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
                    fill={drawMode === "extract-rect" ? "rgba(14,165,233,0.14)" : "rgba(124,58,237,0.12)"}
                    stroke={drawMode === "extract-rect" ? "#0ea5e9" : "#7c3aed"}
                    strokeWidth={1.5}
                    dash={[6, 4]} listening={false}
                  />
                )
              )}
              {marquee && (
                <Rect
                  x={Math.min(marquee.x1, marquee.x2)}
                  y={Math.min(marquee.y1, marquee.y2)}
                  width={Math.abs(marquee.x2 - marquee.x1)}
                  height={Math.abs(marquee.y2 - marquee.y1)}
                  fill="rgba(59,130,246,0.12)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              )}
              <Transformer
                ref={trRef}
                rotateEnabled={selectedLayerIds.length < 2}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
              />
            </KLayer>


            {(drawMode === "extract-rect" || drawMode === "extract-auto") && extractSourceLayer && (
              <KLayer listening={false}>
                <Rect
                  x={extractSourceLayer.position.x}
                  y={extractSourceLayer.position.y}
                  width={extractSourceLayer.size.width}
                  height={extractSourceLayer.size.height}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dash={[10, 6]}
                />
              </KLayer>
            )}

            {drawMode === "extract-auto" && extractSourceLayer && (
              <KLayer>
                {activeSubjectDetections.map((det) => {
                  const sourceRect = {
                    x: extractSourceLayer.position.x,
                    y: extractSourceLayer.position.y,
                    width: extractSourceLayer.size.width,
                    height: extractSourceLayer.size.height,
                  };
                  const r = bboxToCanvasRect(det.bbox, sourceRect);
                  const polygonPoints =
                    det.polygon && det.polygon.length >= 3
                      ? polygonToCanvasPoints(det.polygon, sourceRect)
                      : null;
                  const hovered = hoveredDetectionId === det.id;
                  const labelW = Math.min(220, Math.max(72, det.label.length * 6.5 + 16));
                  const dismissX = polygonPoints
                    ? Math.max(...polygonPoints.filter((_, i) => i % 2 === 0))
                    : r.x + r.width;
                  const dismissY = polygonPoints
                    ? Math.min(...polygonPoints.filter((_, i) => i % 2 === 1))
                    : r.y;

                  return (
                    <Group key={det.id}>
                      {polygonPoints ? (
                        <Line
                          points={polygonPoints}
                          closed
                          fill={hovered ? "rgba(14,165,233,0.22)" : "rgba(14,165,233,0.1)"}
                          stroke="#0ea5e9"
                          strokeWidth={hovered ? 2.5 : 1.5}
                          onMouseEnter={() => setHoveredDetectionId(det.id)}
                          onMouseLeave={() =>
                            setHoveredDetectionId((id) => (id === det.id ? null : id))
                          }
                          onClick={() => !extracting && extractFromSubject(det)}
                          onTap={() => !extracting && extractFromSubject(det)}
                        />
                      ) : (
                        <Rect
                          x={r.x}
                          y={r.y}
                          width={r.width}
                          height={r.height}
                          fill={hovered ? "rgba(14,165,233,0.22)" : "rgba(14,165,233,0.1)"}
                          stroke="#0ea5e9"
                          strokeWidth={hovered ? 2.5 : 1.5}
                          dash={[8, 4]}
                          onMouseEnter={() => setHoveredDetectionId(det.id)}
                          onMouseLeave={() =>
                            setHoveredDetectionId((id) => (id === det.id ? null : id))
                          }
                          onClick={() => !extracting && extractFromSubject(det)}
                          onTap={() => !extracting && extractFromSubject(det)}
                        />
                      )}
                      <Group
                        x={dismissX - 8}
                        y={dismissY - 8}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          if (!extracting) dismissSubjectDetection(det.id);
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          if (!extracting) dismissSubjectDetection(det.id);
                        }}
                      >
                        <Circle radius={10} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
                        <Text text="✕" x={-4.5} y={-6} fontSize={12} fill="#fff" fontStyle="700" listening={false} />
                      </Group>
                      {(hovered || polygonPoints) && (
                        <Group x={r.x + 4} y={r.y + 4} listening={false}>
                          <Rect width={labelW} height={18} fill="#0ea5e9" cornerRadius={4} />
                          <Text
                            text={det.label}
                            x={6}
                            y={3}
                            width={labelW - 12}
                            fontSize={11}
                            fill="#fff"
                            fontStyle="600"
                            ellipsis
                          />
                        </Group>
                      )}
                    </Group>
                  );
                })}
              </KLayer>
            )}

            {hoveredLayerId && hoveredLayerId !== selectedLayerId && !drawMode && (() => {
              const hl = sortedLayers.find((l) => l.id === hoveredLayerId);
              if (!hl) return null;
              const isEllipse = hl.type === "hotspot" && hl.content.hotspotShape === "ellipse";
              return (
                <KLayer listening={false}>
                  {isEllipse ? (
                    <Ellipse
                      x={hl.position.x + hl.size.width / 2}
                      y={hl.position.y + hl.size.height / 2}
                      radiusX={hl.size.width / 2}
                      radiusY={hl.size.height / 2}
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      dash={[6, 4]}
                    />
                  ) : (
                    <Rect
                      x={hl.position.x}
                      y={hl.position.y}
                      width={hl.size.width}
                      height={hl.size.height}
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      dash={[6, 4]}
                    />
                  )}
                </KLayer>
              );
            })()}

            {!drawMode && sortedLayers.some((l) => l.content.extractedFrom && !l.action) && (
              <KLayer listening={false}>
                {sortedLayers
                  .filter((l) => l.content.extractedFrom && !l.action)
                  .map((l) => (
                    <Group key={`cutout-hint-${l.id}`}>
                      <Rect
                        x={l.position.x}
                        y={l.position.y}
                        width={l.size.width}
                        height={l.size.height}
                        stroke="#f59e0b"
                        strokeWidth={selectedLayerId === l.id ? 2 : 1}
                        dash={[8, 5]}
                      />
                      {selectedLayerId === l.id && (
                        <Group x={l.position.x + 4} y={Math.max(0, l.position.y - 22)}>
                          <Rect width={78} height={18} fill="#f59e0b" cornerRadius={4} />
                          <Text text="Add action" x={6} y={3} fontSize={11} fill="#fff" fontStyle="600" />
                        </Group>
                      )}
                    </Group>
                  ))}
              </KLayer>
            )}

            {/* Hitbox overlay */}
            {showHitboxes && (
              <KLayer listening={false}>
                {sortedLayers
                  .filter((l) => l.action || l.type === "hotspot" || l.content.extractedFrom)
                  .map((l) => {
                    const needsAction = !!l.content.extractedFrom && !l.action;
                    const labelText = needsAction
                      ? "Needs action"
                      : l.action
                        ? ACTION_LABEL[l.action.type] || l.action.type
                        : "Hotspot";
                    const stroke = needsAction ? "#f59e0b" : "#7c3aed";
                    const fill = needsAction ? "rgba(245,158,11,0.10)" : "rgba(124,58,237,0.10)";
                    const isEllipse = l.type === "hotspot" && l.content.hotspotShape === "ellipse";
                    return (
                      <Group key={"hb-" + l.id}>
                        {isEllipse ? (
                          <Ellipse
                            x={l.position.x + l.size.width / 2}
                            y={l.position.y + l.size.height / 2}
                            radiusX={l.size.width / 2}
                            radiusY={l.size.height / 2}
                            stroke={stroke}
                            strokeWidth={2}
                            dash={[8, 5]}
                            fill={fill}
                          />
                        ) : (
                          <Rect
                            x={l.position.x} y={l.position.y}
                            width={l.size.width} height={l.size.height}
                            stroke={stroke} strokeWidth={2}
                            dash={[8, 5]} fill={fill}
                          />
                        )}
                        <Group x={l.position.x + 4} y={l.position.y + 4}>
                          <Rect width={Math.max(36, labelText.length * 7 + 12)} height={18} fill={stroke} cornerRadius={4} />
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

          <SocialSlideout settings={flyer.settings.social} />
        </div>
      </div>
    </div>
  );
}
