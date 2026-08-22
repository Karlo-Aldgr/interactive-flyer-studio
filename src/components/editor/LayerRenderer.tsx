import { Layer } from "@/types/flyer";
import { Group, Rect, Circle, Ellipse, Line, Text, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import * as LucideIcons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { useMemo } from "react";

interface Props {
  layer: Layer;
  onSelect: (evt?: any) => void;
  onChange: (patch: Partial<Layer>) => void;
  isSelected: boolean;
  draggable: boolean;
  refSetter?: (node: any) => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  /** Group-drag hooks — used when several layers are selected at once. */
  onDragStartNode?: (id: string, node: any) => void;
  onDragMoveNode?: (id: string, node: any) => void;
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
  const { layer, onSelect, onChange, draggable, refSetter, onHoverStart, onHoverEnd, onDragStartNode, onDragMoveNode } = props;

  const commonProps: any = {
    x: layer.position.x,
    y: layer.position.y,
    width: layer.size.width,
    height: layer.size.height,
    rotation: layer.rotation,
    opacity: layer.style.opacity ?? 1,
    draggable,
    onClick: (e: any) => onSelect(e),
    onTap: (e: any) => onSelect(e),
    onMouseEnter: onHoverStart,
    onMouseLeave: onHoverEnd,
    ref: refSetter,
    onDragStart: (e: any) => onDragStartNode?.(layer.id, e.target),
    onDragMove: (e: any) => onDragMoveNode?.(layer.id, e.target),
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
      const isEllipse = layer.content.hotspotShape === "ellipse";
      if (isEllipse) {
        return (
          <Ellipse
            {...commonProps}
            offsetX={-layer.size.width / 2}
            offsetY={-layer.size.height / 2}
            radiusX={layer.size.width / 2}
            radiusY={layer.size.height / 2}
            fill="rgba(124,58,237,0.001)"
            stroke="#7c3aed"
            strokeWidth={1}
            dash={[6, 4]}
          />
        );
      }
      return (
        <Rect
          {...commonProps}
          fill="rgba(124,58,237,0.001)"
          stroke="#7c3aed"
          strokeWidth={1}
          dash={[6, 4]}
        />
      );
    }
  }
}
