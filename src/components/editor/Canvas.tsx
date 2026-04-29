import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer as KLayer, Rect, Transformer } from "react-konva";
import { useEditorStore } from "@/store/editorStore";
import { LayerRenderer } from "./LayerRenderer";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const nodeRefs = useRef<Record<string, any>>({});

  // local draw state (in canvas coords, not zoomed)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const page = pages.find((p) => p.id === selectedPageId);
  const W = flyer?.settings.width ?? 900;
  const H = flyer?.settings.height ?? 1200;

  const sortedLayers = useMemo(
    () => (page ? [...page.layers].sort((a, b) => a.z_index - b.z_index) : []),
    [page]
  );

  useEffect(() => {
    if (!trRef.current) return;
    if (selectedLayerId && nodeRefs.current[selectedLayerId] && !drawMode) {
      trRef.current.nodes([nodeRefs.current[selectedLayerId]]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedLayerId, sortedLayers, drawMode]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "Escape" && drawMode) {
        setDrawMode(null);
        setDrawStart(null);
        setDrawCurrent(null);
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
  }, [selectedLayerId, page, deleteLayer, updateLayer, drawMode, setDrawMode]);

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

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-muted/40 p-8">
      {drawMode === "hotspot" && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-elegant backdrop-blur">
          <span className="font-medium">Drag on the canvas to draw a hotspot</span>
          <span className="text-muted-foreground">— Esc to cancel</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setDrawMode(null);
              setDrawStart(null);
              setDrawCurrent(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div
        className="shadow-elegant"
        style={{
          width: W * zoom,
          height: H * zoom,
          background: page.background.color || "#fff",
          cursor: drawMode === "hotspot" ? "crosshair" : "default",
        }}
      >
        <Stage
          ref={stageRef}
          width={W * zoom}
          height={H * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={(e) => {
            if (drawMode === "hotspot") {
              const p = getStagePos(e);
              if (p) {
                setDrawStart(p);
                setDrawCurrent(p);
              }
              return;
            }
            if (e.target === e.target.getStage()) selectLayer(null);
          }}
          onMouseMove={(e) => {
            if (drawMode === "hotspot" && drawStart) {
              const p = getStagePos(e);
              if (p) setDrawCurrent(p);
            }
          }}
          onMouseUp={() => {
            if (drawMode === "hotspot" && drawStart && drawCurrent) {
              const w = Math.abs(drawCurrent.x - drawStart.x);
              const h = Math.abs(drawCurrent.y - drawStart.y);
              if (w >= 8 && h >= 8) {
                addHotspotLayer({
                  x: Math.min(drawStart.x, drawCurrent.x),
                  y: Math.min(drawStart.y, drawCurrent.y),
                  width: w,
                  height: h,
                });
              } else {
                setDrawMode(null);
              }
              setDrawStart(null);
              setDrawCurrent(null);
            }
          }}
          onTouchStart={(e) => {
            if (drawMode === "hotspot") {
              const p = getStagePos(e);
              if (p) {
                setDrawStart(p);
                setDrawCurrent(p);
              }
              return;
            }
            if (e.target === e.target.getStage()) selectLayer(null);
          }}
          onTouchMove={(e) => {
            if (drawMode === "hotspot" && drawStart) {
              const p = getStagePos(e);
              if (p) setDrawCurrent(p);
            }
          }}
          onTouchEnd={() => {
            if (drawMode === "hotspot" && drawStart && drawCurrent) {
              const w = Math.abs(drawCurrent.x - drawStart.x);
              const h = Math.abs(drawCurrent.y - drawStart.y);
              if (w >= 8 && h >= 8) {
                addHotspotLayer({
                  x: Math.min(drawStart.x, drawCurrent.x),
                  y: Math.min(drawStart.y, drawCurrent.y),
                  width: w,
                  height: h,
                });
              } else {
                setDrawMode(null);
              }
              setDrawStart(null);
              setDrawCurrent(null);
            }
          }}
        >
          <KLayer>
            <Rect x={0} y={0} width={W} height={H} fill={page.background.color || "#fff"} listening={false} />
            {sortedLayers.map((l) => (
              <LayerRenderer
                key={l.id}
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
            ))}
            {previewRect && (
              <Rect
                x={previewRect.x}
                y={previewRect.y}
                width={previewRect.width}
                height={previewRect.height}
                fill="rgba(124,58,237,0.12)"
                stroke="#7c3aed"
                strokeWidth={1.5}
                dash={[6, 4]}
                listening={false}
              />
            )}
            <Transformer
              ref={trRef}
              rotateEnabled
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
            />
          </KLayer>
        </Stage>
      </div>
    </div>
  );
}
