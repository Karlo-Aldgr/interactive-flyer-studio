import { Layer } from "@/types/flyer";
import { Group, Rect, Circle, Ellipse, Line, Text, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import * as LucideIcons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { useMemo } from "react";

interface Props {
  layer: Layer;
  onSelect: () => void;
  onChange: (patch: Partial<Layer>) => void;
  isSelected: boolean;
  draggable: boolean;
  refSetter?: (node: any) => void;
}

function ImageLayer({ layer, ...rest }: Props & { commonProps: any }) {
  const [img] = useImage(layer.content.src ?? "", "anonymous");
  return (
    <KonvaImage
      {...rest.commonProps}
      image={img}
      cornerRadius={layer.style.cornerRadius}
    />
  );
}

function IconLayer({ layer, commonProps }: { layer: Layer; commonProps: any }) {
  const dataUrl = useMemo(() => {
    const name = layer.content.iconName || "Star";
    const Icon = (LucideIcons as any)[name] || LucideIcons.Star;
    const color = layer.style.color || "#000";
    const svg = renderToStaticMarkup(
      <Icon size={256} color={color} strokeWidth={2} />
    );
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }, [layer.content.iconName, layer.style.color]);
  const [img] = useImage(dataUrl);
  return <KonvaImage {...commonProps} image={img} />;
}

export function LayerRenderer(props: Props) {
  const { layer, onSelect, onChange, draggable, refSetter } = props;

  const commonProps: any = {
    x: layer.position.x,
    y: layer.position.y,
    width: layer.size.width,
    height: layer.size.height,
    rotation: layer.rotation,
    opacity: layer.style.opacity ?? 1,
    draggable,
    onClick: onSelect,
    onTap: onSelect,
    ref: refSetter,
    onDragEnd: (e: any) => onChange({ position: { x: e.target.x(), y: e.target.y() } }),
    onTransformEnd: (e: any) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        position: { x: node.x(), y: node.y() },
        size: {
          width: Math.max(10, node.width() * scaleX),
          height: Math.max(10, node.height() * scaleY),
        },
        rotation: node.rotation(),
      });
    },
  };

  switch (layer.type) {
    case "text":
      return (
        <Text
          {...commonProps}
          text={layer.content.text || ""}
          fontFamily={layer.style.fontFamily || "Plus Jakarta Sans"}
          fontSize={layer.style.fontSize || 24}
          fontStyle={`${layer.style.fontStyle === "italic" ? "italic " : ""}${layer.style.fontWeight ?? "normal"}`}
          fill={layer.style.color || "#000"}
          align={layer.style.align || "left"}
        />
      );
    case "image":
      return <ImageLayer {...props} commonProps={commonProps} />;
    case "icon":
      return <IconLayer layer={layer} commonProps={commonProps} />;
    case "shape":
      if (layer.content.shape === "circle") {
        return (
          <Circle
            {...commonProps}
            radius={Math.min(layer.size.width, layer.size.height) / 2}
            offsetX={-layer.size.width / 2}
            offsetY={-layer.size.height / 2}
            fill={layer.style.fill || "#8b5cf6"}
            stroke={layer.style.stroke}
            strokeWidth={layer.style.strokeWidth}
          />
        );
      }
      if (layer.content.shape === "line") {
        return (
          <Line
            {...commonProps}
            points={[0, layer.size.height / 2, layer.size.width, layer.size.height / 2]}
            stroke={layer.style.fill || "#0f172a"}
            strokeWidth={layer.style.strokeWidth || 4}
          />
        );
      }
      return (
        <Rect
          {...commonProps}
          fill={layer.style.fill || "#8b5cf6"}
          stroke={layer.style.stroke}
          strokeWidth={layer.style.strokeWidth}
          cornerRadius={layer.style.cornerRadius || 0}
        />
      );
    case "button":
      return (
        <Group {...commonProps}>
          <Rect
            width={layer.size.width}
            height={layer.size.height}
            fill={layer.style.fill || "#7c3aed"}
            cornerRadius={layer.style.cornerRadius ?? 999}
          />
          <Text
            width={layer.size.width}
            height={layer.size.height}
            text={layer.content.label || "Button"}
            fontFamily={layer.style.fontFamily || "Plus Jakarta Sans"}
            fontSize={layer.style.fontSize || 16}
            fontStyle={String(layer.style.fontWeight ?? "600")}
            fill={layer.style.color || "#fff"}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      );
    case "hotspot": {
      // Invisible-but-hit-testable shape so the user can select, drag, resize, and rotate it.
      const shape = layer.content.hotspotShape;
      // If a tap highlight is enabled, hide the dashed editor outline so creators
      // don't see two overlapping rings (the highlight overlay already shows where it is).
      const hl = layer.action?.highlight;
      const highlightVisible =
        !!layer.action && hl?.enabled !== false && (hl?.style ?? "pulse") !== "none";
      const strokeProps = highlightVisible
        ? { stroke: undefined, strokeWidth: 0, dash: undefined as number[] | undefined }
        : { stroke: "#7c3aed", strokeWidth: 1, dash: [6, 4] };

      if (shape === "polygon") {
        const pts = layer.content.hotspotPoints || [];
        // Draw the polygon following the layer's bbox; we draw with absolute coords
        // so disable the standard x/y/width/height position to avoid double offset.
        const flat: number[] = [];
        for (const p of pts) {
          flat.push(layer.position.x + p.x * layer.size.width, layer.position.y + p.y * layer.size.height);
        }
        const { onDragEnd, onTransformEnd, ...rest } = commonProps;
        return (
          <Line
            {...rest}
            x={0}
            y={0}
            width={undefined}
            height={undefined}
            points={flat}
            closed
            fill="rgba(124,58,237,0.001)"
            {...strokeProps}
            onDragEnd={(e: any) => {
              // Translate all points by drag delta then reset node position.
              const dx = e.target.x();
              const dy = e.target.y();
              if (!dx && !dy) return;
              e.target.position({ x: 0, y: 0 });
              onChange({ position: { x: layer.position.x + dx, y: layer.position.y + dy } });
            }}
          />
        );
      }
      if (shape === "ellipse") {
        return (
          <Ellipse
            {...commonProps}
            offsetX={-layer.size.width / 2}
            offsetY={-layer.size.height / 2}
            radiusX={layer.size.width / 2}
            radiusY={layer.size.height / 2}
            fill="rgba(124,58,237,0.001)"
            {...strokeProps}
          />
        );
      }
      return (
        <Rect
          {...commonProps}
          fill="rgba(124,58,237,0.001)"
          {...strokeProps}
        />
      );
    }
  }
}
