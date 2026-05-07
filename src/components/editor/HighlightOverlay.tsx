import { useEffect, useRef } from "react";
import { Rect, Ellipse, Circle, Line } from "react-konva";
import Konva from "konva";
import { Layer } from "@/types/flyer";

// Highlight ring shown around tappable layers. Used by both the public viewer
// and the editor canvas so creators can see their highlight settings live.
export function HighlightOverlay({
  layer,
  shape,
}: {
  layer: Layer;
  shape: "rect" | "ellipse" | "polygon";
}) {
  const ref = useRef<any>(null);
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
        node.shadowOpacity(0.3 + 0.6 * e);
        node.shadowBlur(8 + 16 * e);
      }
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
    };
  }, [style, thickness, baseOpacity, color]);

  if (style === "corners") {
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

  if (shape === "polygon") {
    const pts = layer.content.hotspotPoints || [];
    const flat: number[] = [];
    for (const p of pts) {
      flat.push(layer.position.x + p.x * layer.size.width, layer.position.y + p.y * layer.size.height);
    }
    return (
      <Line
        ref={ref}
        points={flat}
        closed
        stroke={color}
        strokeWidth={thickness}
        opacity={baseOpacity}
        dash={dashed ? [thickness * 3, thickness * 2] : undefined}
        shadowColor={color}
        shadowBlur={style === "glow" ? 16 : style === "pulse" ? 12 : 0}
        shadowOpacity={style === "glow" ? 0.7 : style === "pulse" ? 0.6 : 0}
        fill={style === "solid" || style === "dashed" ? undefined : `${color}14`}
        lineJoin="round"
        listening={false}
      />
    );
  }

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
