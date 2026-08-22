import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Trash2, Type, Image, Square, MousePointerClick, Star, SquareDashed, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Layer } from "@/types/flyer";

const ICON: Record<Layer["type"], any> = {
  text: Type, image: Image, shape: Square, button: MousePointerClick, icon: Star, hotspot: SquareDashed,
};

export function LayersPanel() {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const toggleLayerSelection = useEditorStore((s) => s.toggleLayerSelection);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const bringForward = useEditorStore((s) => s.bringForward);
  const sendBackward = useEditorStore((s) => s.sendBackward);
  const bringToFront = useEditorStore((s) => s.bringToFront);
  const sendToBack = useEditorStore((s) => s.sendToBack);

  const page = pages.find((p) => p.id === selectedPageId);
  const layers = page ? [...page.layers].sort((a, b) => b.z_index - a.z_index) : [];

  return (
    <div className="flex flex-col border-t border-border">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Layers</div>
      <div className="max-h-72 overflow-y-auto">
        {layers.length === 0 && <div className="p-4 text-xs text-muted-foreground">No layers yet.</div>}
        {layers.map((l) => {
          const isCutout = !!l.content.extractedFrom;
          const Icon = isCutout ? Scissors : ICON[l.type];
          const label = isCutout
            ? (l.content.label || l.content.subjectLabel || "Cutout")
            : (l.content.text || l.content.label || l.content.iconName || l.type);
          const active = l.id === selectedLayerId;
          return (
            <div
              key={l.id}
              className={`group flex items-center gap-2 border-b border-border px-3 py-2 text-sm cursor-pointer ${active ? "bg-primary/10" : "hover:bg-muted/60"}`}
              onClick={() => selectLayer(l.id)}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isCutout ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 truncate">{label}</span>
              {isCutout && (
                <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] uppercase">
                  Cutout
                </Badge>
              )}
              {isCutout && !l.action && (
                <span className="shrink-0 text-[9px] font-medium text-amber-600">No action</span>
              )}
              <div className="flex opacity-0 group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Bring to front" onClick={(e) => { e.stopPropagation(); bringToFront(l.id); }}>
                  <ChevronsUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Bring forward" onClick={(e) => { e.stopPropagation(); bringForward(l.id); }}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Send backward" onClick={(e) => { e.stopPropagation(); sendBackward(l.id); }}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Send to back" onClick={(e) => { e.stopPropagation(); sendToBack(l.id); }}>
                  <ChevronsDown className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Delete" onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
