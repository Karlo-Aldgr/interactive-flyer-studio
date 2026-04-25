import { useRef, useEffect } from "react";
import { Group, Rect, Circle, Text, Image as KImage, Line } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import type { Layer } from "@/types/flyer";

interface Props {
  layer: Layer;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (patch: Partial<Layer>) => void;
  snap: (n: number) => number;
}

export function CanvasLayer({ layer, isSelected, onSelect, onChange, snap }: Props) {
  const nodeRef = useRef<Konva.Group>(null);
  const [img] = useImage(layer.content.src ?? "", "anonymous");

  useEffect(() => {
    if (isSelected && nodeRef.current) {
      // signal parent transformer via custom name
      nodeRef.current.getStage()?.batchDraw();
    }
  }, [isSelected]);

  const commonProps = {
    ref: nodeRef,
    name: `layer-${layer.id}`,
    x: layer.position.x,
    y: layer.position.y,
    width: layer.size.width,
    height: layer.size.height,
    rotation: layer.rotation,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({
        position: { x: snap(e.target.x()), y: snap(e.target.y()) },
      });
    },
    onTransformEnd: () => {
      const node = nodeRef.current;
      if (!node) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        position: { x: snap(node.x()), y: snap(node.y()) },
        size: {
          width: Math.max(20, snap(layer.size.width * scaleX)),
          height: Math.max(20, snap(layer.size.height * scaleY)),
        },
        rotation: node.rotation(),
      });
    },
  };

  const renderBody = () => {
    switch (layer.type) {
      case "text":
        return (
          <Text
            text={layer.content.text ?? ""}
            fontSize={layer.style.fontSize ?? 24}
            fontStyle={`${layer.style.fontStyle ?? "normal"} ${layer.style.fontWeight ?? 400}`}
            fontFamily={layer.style.fontFamily ?? "Plus Jakarta Sans"}
            fill={layer.style.color ?? "#000"}
            align={layer.style.align ?? "left"}
            width={layer.size.width}
            height={layer.size.height}
            verticalAlign="middle"
          />
        );
      case "image":
        return img ? (
          <KImage
            image={img}
            width={layer.size.width}
            height={layer.size.height}
            cornerRadius={layer.style.cornerRadius ?? 0}
          />
        ) : (
          <Rect
            width={layer.size.width}
            height={layer.size.height}
            fill="#ede9fe"
            stroke="#a78bfa"
            dash={[6, 6]}
            cornerRadius={layer.style.cornerRadius ?? 0}
          />
        );
      case "shape":
        if (layer.content.shape === "circle") {
          return (
            <Circle
              x={layer.size.width / 2}
              y={layer.size.height / 2}
              radius={Math.min(layer.size.width, layer.size.height) / 2}
              fill={layer.style.fill ?? "#a78bfa"}
              stroke={layer.style.stroke}
              strokeWidth={layer.style.strokeWidth ?? 0}
              opacity={layer.style.opacity ?? 1}
            />
          );
        }
        if (layer.content.shape === "line") {
          return (
            <Line
              points={[0, layer.size.height / 2, layer.size.width, layer.size.height / 2]}
              stroke={layer.style.fill ?? "#a78bfa"}
              strokeWidth={Math.max(2, layer.style.strokeWidth ?? 4)}
            />
          );
        }
        return (
          <Rect
            width={layer.size.width}
            height={layer.size.height}
            fill={layer.style.fill ?? "#a78bfa"}
            cornerRadius={layer.style.cornerRadius ?? 0}
            stroke={layer.style.stroke}
            strokeWidth={layer.style.strokeWidth ?? 0}
            opacity={layer.style.opacity ?? 1}
          />
        );
      case "button":
        return (
          <>
            <Rect
              width={layer.size.width}
              height={layer.size.height}
              fill={layer.style.fill ?? "#7c3aed"}
              cornerRadius={layer.style.cornerRadius ?? 999}
              shadowBlur={layer.style.shadow ? 12 : 0}
              shadowColor="rgba(124,58,237,0.4)"
              shadowOffsetY={layer.style.shadow ? 4 : 0}
            />
            <Text
              text={layer.content.label ?? "Button"}
              fontSize={layer.style.fontSize ?? 18}
              fontStyle={`${layer.style.fontWeight ?? 700}`}
              fontFamily={layer.style.fontFamily ?? "Plus Jakarta Sans"}
              fill={layer.style.color ?? "#fff"}
              align="center"
              verticalAlign="middle"
              width={layer.size.width}
              height={layer.size.height}
            />
          </>
        );
      case "icon":
        // Simple placeholder circle for icon — full lucide rendering via SVG would
        // require additional setup. Inspector shows icon name.
        return (
          <>
            <Circle
              x={layer.size.width / 2}
              y={layer.size.height / 2}
              radius={Math.min(layer.size.width, layer.size.height) / 2}
              fill={layer.style.fill ?? "#ede9fe"}
            />
            <Text
              text={(layer.content.iconName ?? "★").slice(0, 2)}
              fontSize={layer.size.height * 0.5}
              fontStyle="700"
              fill={layer.style.color ?? "#7c3aed"}
              align="center"
              verticalAlign="middle"
              width={layer.size.width}
              height={layer.size.height}
            />
          </>
        );
    }
  };

  return <Group {...commonProps}>{renderBody()}</Group>;
}
