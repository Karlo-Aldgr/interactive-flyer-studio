import { useEditorStore } from "@/store/editorStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ActionEditor } from "./ActionEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Inspector() {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateLayerStyle = useEditorStore((s) => s.updateLayerStyle);
  const updateLayerContent = useEditorStore((s) => s.updateLayerContent);
  const setLayerAction = useEditorStore((s) => s.setLayerAction);
  const setPageBackground = useEditorStore((s) => s.setPageBackground);

  const page = pages.find((p) => p.id === selectedPageId);
  const layer = page?.layers.find((l) => l.id === selectedLayerId);

  if (!layer) {
    return (
      <div className="p-4">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Page</div>
        <Label className="text-xs">Background color</Label>
        <Input
          type="color"
          className="mt-1 h-9 w-full"
          value={page?.background.color || "#ffffff"}
          onChange={(e) => page && setPageBackground(page.id, e.target.value)}
        />
        <p className="mt-6 text-xs text-muted-foreground">Select a layer to edit its style and action.</p>
      </div>
    );
  }

  const isHotspot = layer.type === "hotspot";

  return (
    <Tabs defaultValue={isHotspot ? "action" : "style"} className="flex h-full flex-col">
      <TabsList className="m-3 grid grid-cols-2">
        <TabsTrigger value="style">Style</TabsTrigger>
        <TabsTrigger value="action">Action</TabsTrigger>
      </TabsList>

      <TabsContent value="style" className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {isHotspot && (
          <>
            <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-[11px] text-muted-foreground">
              Hotspots are invisible to viewers — only the cursor changes on hover. Use the <strong>Action</strong> tab to make it linkable.
            </div>
            <div>
              <Label className="text-xs">Shape</Label>
              <Select
                value={layer.content.hotspotShape || "rect"}
                onValueChange={(v) => updateLayerContent(layer.id, { hotspotShape: v as any })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rect">Rectangle</SelectItem>
                  <SelectItem value="ellipse">Ellipse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {layer.type === "text" && (
          <>
            <div>
              <Label className="text-xs">Text</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={layer.content.text || ""}
                onChange={(e) => updateLayerContent(layer.id, { text: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Font size: {layer.style.fontSize ?? 24}</Label>
              <Slider
                min={8} max={120} step={1}
                value={[layer.style.fontSize ?? 24]}
                onValueChange={([v]) => updateLayerStyle(layer.id, { fontSize: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Weight</Label>
              <Select value={String(layer.style.fontWeight ?? 400)} onValueChange={(v) => updateLayerStyle(layer.id, { fontWeight: Number(v) })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[300, 400, 500, 600, 700, 800].map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Align</Label>
              <Select value={layer.style.align || "left"} onValueChange={(v) => updateLayerStyle(layer.id, { align: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <Input type="color" className="mt-1 h-9 w-full" value={layer.style.color || "#000000"} onChange={(e) => updateLayerStyle(layer.id, { color: e.target.value })} />
            </div>
          </>
        )}

        {layer.type === "button" && (
          <>
            <div>
              <Label className="text-xs">Label</Label>
              <Input className="mt-1" value={layer.content.label || ""} onChange={(e) => updateLayerContent(layer.id, { label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Background</Label>
              <Input type="color" className="mt-1 h-9 w-full" value={layer.style.fill || "#7c3aed"} onChange={(e) => updateLayerStyle(layer.id, { fill: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Text color</Label>
              <Input type="color" className="mt-1 h-9 w-full" value={layer.style.color || "#ffffff"} onChange={(e) => updateLayerStyle(layer.id, { color: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Corner radius: {layer.style.cornerRadius ?? 999}</Label>
              <Slider min={0} max={999} step={1} value={[layer.style.cornerRadius ?? 999]} onValueChange={([v]) => updateLayerStyle(layer.id, { cornerRadius: v })} />
            </div>
          </>
        )}

        {layer.type === "shape" && (
          <>
            <div>
              <Label className="text-xs">Fill</Label>
              <Input type="color" className="mt-1 h-9 w-full" value={layer.style.fill || "#8b5cf6"} onChange={(e) => updateLayerStyle(layer.id, { fill: e.target.value })} />
            </div>
            {layer.content.shape !== "line" && (
              <div>
                <Label className="text-xs">Corner radius: {layer.style.cornerRadius ?? 0}</Label>
                <Slider min={0} max={200} step={1} value={[layer.style.cornerRadius ?? 0]} onValueChange={([v]) => updateLayerStyle(layer.id, { cornerRadius: v })} />
              </div>
            )}
          </>
        )}

        {layer.type === "icon" && (
          <div>
            <Label className="text-xs">Color</Label>
            <Input type="color" className="mt-1 h-9 w-full" value={layer.style.color || "#7c3aed"} onChange={(e) => updateLayerStyle(layer.id, { color: e.target.value })} />
          </div>
        )}

        {layer.type === "image" && (
          <div>
            <Label className="text-xs">Image URL</Label>
            <Input className="mt-1" value={layer.content.src || ""} onChange={(e) => updateLayerContent(layer.id, { src: e.target.value })} />
          </div>
        )}

        <div>
          <Label className="text-xs">Opacity: {Math.round((layer.style.opacity ?? 1) * 100)}%</Label>
          <Slider min={0} max={100} step={1} value={[Math.round((layer.style.opacity ?? 1) * 100)]} onValueChange={([v]) => updateLayerStyle(layer.id, { opacity: v / 100 })} />
        </div>
      </TabsContent>

      <TabsContent value="action" className="flex-1 overflow-y-auto px-3 pb-3">
        <ActionEditor action={layer.action ?? null} onChange={(a) => setLayerAction(layer.id, a)} />
      </TabsContent>
    </Tabs>
  );
}
