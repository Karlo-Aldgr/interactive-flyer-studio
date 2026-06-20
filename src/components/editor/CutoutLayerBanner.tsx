import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scissors, MousePointerClick } from "lucide-react";
import type { Layer } from "@/types/flyer";

type CutoutLayerBannerProps = {
  layer: Layer;
  sourceLayer?: Layer;
  onSelectSource: () => void;
  onLabelChange: (label: string) => void;
  variant?: "style" | "action";
};

export function CutoutLayerBanner({
  layer,
  sourceLayer,
  onSelectSource,
  onLabelChange,
  variant = "style",
}: CutoutLayerBannerProps) {
  if (!layer.content.extractedFrom) return null;

  const sourceName =
    sourceLayer?.content.label ||
    sourceLayer?.content.src?.split("/").pop() ||
    "source image";

  if (variant === "action") {
    return (
      <div className="mb-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-[11px] text-muted-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <MousePointerClick className="h-3.5 w-3.5 text-primary" />
          Interactive cutout
        </div>
        <p>
          Add an action below to make this object clickable in the published flyer. The original{" "}
          <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={onSelectSource}>
            {sourceName}
          </button>{" "}
          stays unchanged underneath.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px] uppercase tracking-wide">
          <Scissors className="h-3 w-3" />
          Cutout
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          From{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            onClick={onSelectSource}
          >
            {sourceName}
          </button>
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Non-destructive extract — the source image is untouched. Use the Action tab to link this object.
      </p>
      <div>
        <Label className="text-xs">Display name</Label>
        <Input
          className="mt-1 h-8"
          value={layer.content.label || ""}
          placeholder="Cutout"
          onChange={(e) => onLabelChange(e.target.value)}
        />
      </div>
      {sourceLayer && (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onSelectSource}>
          Select source image
        </Button>
      )}
    </div>
  );
}
