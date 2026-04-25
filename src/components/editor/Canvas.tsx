import { useEffect, useRef } from "react";
import { Stage, Layer as KLayer, Rect, Line, Transformer } from "react-konva";
import type Konva from "konva";
import { useEditorStore } from "@/store/editorStore";
import { CanvasLayer } from "./CanvasLayer";

export function Canvas() {
  const flyer = useEditorStore((s) => s.flyer);
  const pages = useEditorStore((s) => s.pages);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const gridSize = useEditorStore((s) => s.gridSize);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const page = pages.find((p) => p.id === currentPageId);
  const W = flyer?.settings.width ?? 900;
  const H = flyer?.settings.height ?? 1200;

  const snap = (n: number) => (snapToGrid ? Math.round(n / gridSize) * gridSize : n);

  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const nodes = selectedLayerIds
      .map((id) => stageRef.current!.findOne(`.layer-${id}`))
      .filter(Boolean) as Konva.Node[];
    trRef.current.nodes(nodes);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedLayerIds, page?.layers]);

  if (!page) return null;

  const sortedLayers = [...page.layers].sort((a, b) => a.z_index - b.z_index);

  // Grid lines
  const gridLines: JSX.Element[] = [];
  if (showGrid) {
    for (let x = gridSize; x < W; x += gridSize) {
      gridLines.push(
        <Line key={`gx-${x}`} points={[x, 0, x, H]} stroke="#e9d5ff" strokeWidth={0.5} listening={false} />,
      );
    }
    for (let y = gridSize; y < H; y += gridSize) {
      gridLines.push(
        <Line key={`gy-${y}`} points={[0, y, W, y]} stroke="#e9d5ff" strokeWidth={0.5} listening={false} />,
      );
    }
  }

  return (
    <div className="h-full w-full overflow-auto bg-muted/40 p-8">
      <div className="mx-auto" style={{ width: W * zoom, height: H * zoom }}>
        <Stage
          ref={stageRef}
          width={W * zoom}
          height={H * zoom}
          scaleX={zoom}
          scaleY={zoom}
          className="rounded-2xl shadow-elegant"
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) selectLayer(null);
          }}
        >
          <KLayer>
            <Rect
              width={W}
              height={H}
              fill={page.background.color ?? "#ffffff"}
              listening={false}
            />
            {gridLines}
          </KLayer>
          <KLayer>
            {sortedLayers.map((layer) => (
              <CanvasLayer
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerIds.includes(layer.id)}
                snap={snap}
                onSelect={(e) => {
                  const shift = "shiftKey" in e.evt ? (e.evt as MouseEvent).shiftKey : false;
                  selectLayer(layer.id, shift);
                }}
                onChange={(patch) => {
                  pushHistory();
                  updateLayer(layer.id, patch);
                }}
              />
            ))}
            <Transformer
              ref={trRef}
              rotateEnabled
              keepRatio={false}
              borderStroke="#7c3aed"
              anchorStroke="#7c3aed"
              anchorFill="#fff"
              anchorSize={10}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return oldBox;
                return newBox;
              }}
            />
          </KLayer>
        </Stage>
      </div>
    </div>
  );
}
