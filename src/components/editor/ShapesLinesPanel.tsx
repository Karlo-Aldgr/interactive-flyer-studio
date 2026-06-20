import { useState, type ComponentType } from "react";
import { Square, Circle, Triangle, Hexagon, Minus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { SHAPE_PRESETS, type ShapeVariant } from "@/lib/editorToolPresets";
import { cn } from "@/lib/utils";

const SHAPE_ICONS: Partial<Record<ShapeVariant, ComponentType<{ className?: string }>>> = {
  rect: Square,
  square: Square,
  circle: Circle,
  triangle: Triangle,
  octagon: Hexagon,
  line: Minus,
  "dashed-line": Minus,
  divider: Minus,
};

export function ShapesLinesPanel() {
  const addShapeLayer = useEditorStore((s) => s.addShapeLayer);
  const [open, setOpen] = useState(false);

  const shapes = SHAPE_PRESETS.filter((p) => p.section === "shapes");
  const lines = SHAPE_PRESETS.filter((p) => p.section === "lines");

  function pick(variant: ShapeVariant) {
    addShapeLayer(variant);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant={open ? "secondary" : "ghost"} size="icon" className="h-12 w-12">
              <Square className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">Shapes &amp; Lines</TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="start" className="w-56 p-3">
        <div className="mb-2 text-sm font-semibold">Shapes &amp; Lines</div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shapes</div>
        <div className="mb-3 grid grid-cols-3 gap-1">
          {shapes.map((preset) => {
            const Icon = SHAPE_ICONS[preset.id] || Square;
            return (
              <Button
                key={preset.id}
                variant="ghost"
                className="flex h-auto flex-col gap-1 px-1 py-2 text-[10px]"
                onClick={() => pick(preset.id)}
              >
                <Icon className="h-4 w-4" />
                {preset.label}
              </Button>
            );
          })}
        </div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lines</div>
        <div className="grid grid-cols-3 gap-1">
          {lines.map((preset) => {
            const Icon = SHAPE_ICONS[preset.id] || Minus;
            return (
              <Button
                key={preset.id}
                variant="ghost"
                className={cn(
                  "flex h-auto flex-col gap-1 px-1 py-2 text-[10px]",
                  preset.id === "dashed-line" && "[&_svg]:stroke-dasharray-4"
                )}
                onClick={() => pick(preset.id)}
              >
                <Icon className={cn("h-4 w-4", preset.id === "dashed-line" && "opacity-70")} />
                {preset.label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
