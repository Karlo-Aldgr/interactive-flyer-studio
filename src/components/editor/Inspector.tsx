import { useEditorStore } from "@/store/editorStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function Inspector() {
  const pages = useEditorStore((s) => s.pages);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const updateLayerStyle = useEditorStore((s) => s.updateLayerStyle);
  const updateLayerContent = useEditorStore((s) => s.updateLayerContent);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const reorderLayer = useEditorStore((s) => s.reorderLayer);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const page = pages.find((p) => p.id === currentPageId);
  const layer = page?.layers.find((l) => l.id === selectedLayerIds[0]);

  if (!layer) {
    return (
      <div className="flex h-full w-72 flex-col border-l bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Inspector
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Select an element to edit its properties.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-72 flex-col gap-4 overflow-y-auto border-l bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {layer.type}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "top")} title="Bring to front">
            <ChevronsUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "up")} title="Bring forward">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "down")} title="Send backward">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "bottom")} title="Send to back">
            <ChevronsDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Position & size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">X</Label>
          <Input
            type="number"
            value={Math.round(layer.position.x)}
            onChange={(e) => {
              pushHistory();
              updateLayer(layer.id, { position: { ...layer.position, x: Number(e.target.value) } });
            }}
          />
        </div>
        <div>
          <Label className="text-xs">Y</Label>
          <Input
            type="number"
            value={Math.round(layer.position.y)}
            onChange={(e) => {
              pushHistory();
              updateLayer(layer.id, { position: { ...layer.position, y: Number(e.target.value) } });
            }}
          />
        </div>
        <div>
          <Label className="text-xs">W</Label>
          <Input
            type="number"
            value={Math.round(layer.size.width)}
            onChange={(e) => {
              pushHistory();
              updateLayer(layer.id, { size: { ...layer.size, width: Number(e.target.value) } });
            }}
          />
        </div>
        <div>
          <Label className="text-xs">H</Label>
          <Input
            type="number"
            value={Math.round(layer.size.height)}
            onChange={(e) => {
              pushHistory();
              updateLayer(layer.id, { size: { ...layer.size, height: Number(e.target.value) } });
            }}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Rotation: {Math.round(layer.rotation)}°</Label>
        <Slider
          value={[layer.rotation]}
          min={-180}
          max={180}
          step={1}
          onValueChange={(v) => updateLayer(layer.id, { rotation: v[0] })}
        />
      </div>

      {/* Type-specific */}
      {layer.type === "text" && (
        <>
          <div>
            <Label className="text-xs">Text</Label>
            <Textarea
              value={layer.content.text ?? ""}
              onChange={(e) => updateLayerContent(layer.id, { text: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Size</Label>
              <Input
                type="number"
                value={layer.style.fontSize ?? 24}
                onChange={(e) => updateLayerStyle(layer.id, { fontSize: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Weight</Label>
              <Input
                type="number"
                step={100}
                value={Number(layer.style.fontWeight ?? 400)}
                onChange={(e) => updateLayerStyle(layer.id, { fontWeight: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <Input
              type="color"
              value={layer.style.color ?? "#000000"}
              onChange={(e) => updateLayerStyle(layer.id, { color: e.target.value })}
            />
          </div>
        </>
      )}

      {layer.type === "button" && (
        <>
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              value={layer.content.label ?? ""}
              onChange={(e) => updateLayerContent(layer.id, { label: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Background</Label>
              <Input
                type="color"
                value={layer.style.fill ?? "#7c3aed"}
                onChange={(e) => updateLayerStyle(layer.id, { fill: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Text color</Label>
              <Input
                type="color"
                value={layer.style.color ?? "#ffffff"}
                onChange={(e) => updateLayerStyle(layer.id, { color: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      {layer.type === "shape" && (
        <>
          <div>
            <Label className="text-xs">Fill</Label>
            <Input
              type="color"
              value={layer.style.fill ?? "#a78bfa"}
              onChange={(e) => updateLayerStyle(layer.id, { fill: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Corner radius</Label>
            <Slider
              value={[layer.style.cornerRadius ?? 0]}
              min={0}
              max={200}
              onValueChange={(v) => updateLayerStyle(layer.id, { cornerRadius: v[0] })}
            />
          </div>
        </>
      )}

      {layer.type === "image" && (
        <div>
          <Label className="text-xs">Image URL</Label>
          <Input
            value={layer.content.src ?? ""}
            onChange={(e) => updateLayerContent(layer.id, { src: e.target.value })}
            placeholder="https://..."
          />
        </div>
      )}

      {layer.type === "icon" && (
        <div>
          <Label className="text-xs">Icon name</Label>
          <Input
            value={layer.content.iconName ?? ""}
            onChange={(e) => updateLayerContent(layer.id, { iconName: e.target.value })}
          />
        </div>
      )}

      <div>
        <Label className="text-xs">Opacity: {Math.round((layer.style.opacity ?? 1) * 100)}%</Label>
        <Slider
          value={[(layer.style.opacity ?? 1) * 100]}
          min={0}
          max={100}
          onValueChange={(v) => updateLayerStyle(layer.id, { opacity: v[0] / 100 })}
        />
      </div>

      <div className="mt-auto flex gap-2 pt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => duplicateLayer(layer.id)}>
          <Copy className="mr-1 h-4 w-4" /> Duplicate
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" onClick={() => deleteLayer(layer.id)}>
          <Trash2 className="mr-1 h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}
