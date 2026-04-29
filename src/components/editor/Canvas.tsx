import { useEffect, useMemo, useRef } from "react";
import { Stage, Layer as KLayer, Rect, Transformer } from "react-konva";
import { useEditorStore } from "@/store/editorStore";
import { LayerRenderer } from "./LayerRenderer";

export function Canvas() {
  const flyer = useEditorStore((s) => s.flyer);
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const zoom = useEditorStore((s) => s.zoom);

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const nodeRefs = useRef<Record<string, any>>({});

  const page = pages.find((p) => p.id === selectedPageId);
  const W = flyer?.settings.width ?? 900;
  const H = flyer?.settings.height ?? 1200;

  const sortedLayers = useMemo(
    () => (page ? [...page.layers].sort((a, b) => a.z_index - b.z_index) : []),
    [page]
  );

  useEffect(() => {
    if (!trRef.current) return;
    if (selectedLayerId && nodeRefs.current[selectedLayerId]) {
      trRef.current.nodes([nodeRefs.current[selectedLayerId]]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedLayerId, sortedLayers]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedLayerId) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
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
  }, [selectedLayerId, page, deleteLayer, updateLayer]);

  if (!page || !flyer) return null;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-muted/40 p-8">
      <div
        className="shadow-elegant"
        style={{ width: W * zoom, height: H * zoom, background: page.background.color || "#fff" }}
      >
        <Stage
          ref={stageRef}
          width={W * zoom}
          height={H * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) selectLayer(null);
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage()) selectLayer(null);
          }}
        >
          <KLayer>
            <Rect x={0} y={0} width={W} height={H} fill={page.background.color || "#fff"} listening={false} />
            {sortedLayers.map((l) => (
              <LayerRenderer
                key={l.id}
                layer={l}
                isSelected={selectedLayerId === l.id}
                draggable
                onSelect={() => selectLayer(l.id)}
                onChange={(patch) => updateLayer(l.id, patch)}
                refSetter={(node) => {
                  if (node) nodeRefs.current[l.id] = node;
                  else delete nodeRefs.current[l.id];
                }}
              />
            ))}
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
