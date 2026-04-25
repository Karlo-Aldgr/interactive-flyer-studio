import { Type, Image as ImageIcon, Square, Circle, Minus, Star, MousePointerClick } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import type { LayerType } from "@/types/flyer";
import { Button } from "@/components/ui/button";

const items: Array<{ type: LayerType; label: string; Icon: typeof Type; partial?: any }> = [
  { type: "text", label: "Text", Icon: Type },
  { type: "image", label: "Image", Icon: ImageIcon },
  { type: "button", label: "Button", Icon: MousePointerClick },
  { type: "shape", label: "Rectangle", Icon: Square, partial: { content: { shape: "rect" } } },
  { type: "shape", label: "Circle", Icon: Circle, partial: { content: { shape: "circle" } } },
  { type: "shape", label: "Line", Icon: Minus, partial: { content: { shape: "line" }, size: { width: 240, height: 8 } } },
  { type: "icon", label: "Icon", Icon: Star },
];

export function ElementsPanel() {
  const addLayer = useEditorStore((s) => s.addLayer);

  return (
    <div className="flex h-full w-56 flex-col border-r bg-card p-3">
      <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Elements
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ type, label, Icon, partial }) => (
          <Button
            key={label}
            variant="outline"
            className="flex h-20 flex-col items-center justify-center gap-1.5"
            onClick={() => addLayer(type, partial)}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
