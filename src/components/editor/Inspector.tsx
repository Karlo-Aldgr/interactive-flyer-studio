import { useEditorStore } from "@/store/editorStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ActionEditor } from "./ActionEditor";
import { CutoutLayerBanner } from "./CutoutLayerBanner";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FONT_OPTIONS, FONT_GROUPS, DEFAULT_FONT } from "@/lib/fontOptions";
import { Play, Sparkles, Upload, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFlyerAsset } from "@/lib/uploadFlyerAsset";
import type { IntroPreset, PageIntro } from "@/types/flyer";

const INTRO_PRESETS: { value: IntroPreset; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade in" },
  { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" },
  { value: "slide-left", label: "Slide left" },
  { value: "slide-right", label: "Slide right" },
  { value: "zoom", label: "Zoom in" },
  { value: "pop", label: "Pop" },
  { value: "blur", label: "Blur in" },
  { value: "drop", label: "Drop" },
];

/** Inline "where does this go?" editor for the common single-destination actions. */
function QuickLinkField({
  layer,
  onAction,
  onLabel,
}: {
  layer: Layer;
  onAction: (a: LayerAction | null) => void;
  onLabel: (label: string) => void;
}) {
  const action = layer.action ?? null;
  const type = action?.type;
  const kind =
    type === "call" || type === "sms" ? "phone" : type === "map" ? "address" : type === "open_url" || !action ? "url" : null;
  if (!kind) return null;

  const value =
    kind === "phone" ? (action?.payload?.phone ?? "") : kind === "address" ? (action?.payload?.mapAddress ?? "") : (action?.payload?.url ?? "");

  const label =
    kind === "phone" ? "Phone number" : kind === "address" ? "Address" : "Link / destination";
  const placeholder =
    kind === "phone" ? "+1 555 123 4567" : kind === "address" ? "123 Main St, City" : "https://example.com";

  function commit(raw: string) {
    const v = raw.trim();

    if (kind === "phone" || kind === "address") {
      if (!action) return;
      onAction({
        ...action,
        payload: { ...action.payload, ...(kind === "phone" ? { phone: raw } : { mapAddress: raw }) },
      });
      return;
    }

    if (!v) {
      if (action?.type === "open_url") onAction({ ...action, payload: { ...action.payload, url: "" } });
      return;
    }

    const url = normalizeUrl(v) || v;
    if (action?.type === "open_url") {
      onAction({ ...action, payload: { ...action.payload, url } });
    } else {
      onAction({ id: safeUUID(), type: "open_url", payload: { url, newTab: true }, highlight: action?.highlight });
    }

    // Clear "Setup Required" placeholder wording once a real link exists.
    const current = layer.content.label || "";
    if (/setup required/i.test(current)) {
      const cleaned = current.replace(/\s*\n?\s*setup required\s*/gi, "").trim();
      if (cleaned) onLabel(cleaned);
    }
  }

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        className="mt-1"
        defaultValue={value}
        key={`${layer.id}-${kind}-${value}`}
        placeholder={placeholder}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {kind === "url"
          ? "Opens when this button is tapped. Use the Action tab for popups, forms and more."
          : "Edit the destination for this button. More options in the Action tab."}
      </p>
    </div>
  );
}


export function Inspector() {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const updateLayersStyle = useEditorStore((s) => s.updateLayersStyle);
  const alignLayers = useEditorStore((s) => s.alignLayers);
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers);
  const deleteLayers = useEditorStore((s) => s.deleteLayers);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const updateLayerStyle = useEditorStore((s) => s.updateLayerStyle);
  const updateLayerContent = useEditorStore((s) => s.updateLayerContent);
  const setLayerAction = useEditorStore((s) => s.setLayerAction);
  const setLayerIntro = useEditorStore((s) => s.setLayerIntro);
  const setPageBackground = useEditorStore((s) => s.setPageBackground);
  const replayIntro = useEditorStore((s) => s.replayIntro);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const flyer = useEditorStore((s) => s.flyer);
  const { user } = useAuth();
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function uploadLayerImage(file: File, layerId: string) {
    if (!user) { toast.error("Sign in required"); return; }
    if (!flyer) { toast.error("Open a flyer first"); return; }
    setUploadingImage(true);
    try {
      const url = await uploadFlyerAsset(user.id, flyer.id, file, "images");
      updateLayerContent(layerId, { src: url });
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Could not upload image");
    } finally {
      setUploadingImage(false);
    }
  }



  const page = pages.find((p) => p.id === selectedPageId);
  const layer = page?.layers.find((l) => l.id === selectedLayerId);
  const sourceLayer = layer?.content.extractedFrom
    ? page?.layers.find((l) => l.id === layer.content.extractedFrom)
    : undefined;

  if (selectedLayerIds.length > 1) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          {selectedLayerIds.length} layers selected
        </div>
        <div>
          <Label className="text-xs">Font</Label>
          <FontSelect
            value={undefined}
            onChange={(v) => updateLayersStyle(selectedLayerIds, { fontFamily: v })}
          />
        </div>
        <div>

          <Label className="text-xs">Opacity</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="mt-1 h-9"
            placeholder="1"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) updateLayersStyle(selectedLayerIds, { opacity: Math.max(0, Math.min(1, v)) });
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => alignLayers(selectedLayerIds, "left")}>Align left</Button>
          <Button size="sm" variant="outline" onClick={() => alignLayers(selectedLayerIds, "hcenter")}>Center H</Button>
          <Button size="sm" variant="outline" onClick={() => alignLayers(selectedLayerIds, "right")}>Align right</Button>
          <Button size="sm" variant="outline" onClick={() => alignLayers(selectedLayerIds, "top")}>Align top</Button>
          <Button size="sm" variant="outline" onClick={() => alignLayers(selectedLayerIds, "vcenter")}>Center V</Button>
          <Button size="sm" variant="outline" onClick={() => alignLayers(selectedLayerIds, "bottom")}>Align bottom</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => duplicateLayers(selectedLayerIds)}>Duplicate</Button>
          <Button size="sm" variant="destructive" onClick={() => deleteLayers(selectedLayerIds)}>Delete all</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear selection</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Shift-click layers to add or remove them, or drag on empty canvas to marquee-select.
        </p>
      </div>
    );
  }

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
      <TabsList className="m-3 grid grid-cols-3">
        <TabsTrigger value="style">Style</TabsTrigger>
        <TabsTrigger value="action">Action</TabsTrigger>
        <TabsTrigger value="animation">Animate</TabsTrigger>
      </TabsList>

      <TabsContent value="style" className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {layer.content.extractedFrom && (
          <CutoutLayerBanner
            layer={layer}
            sourceLayer={sourceLayer}
            onSelectSource={() => layer.content.extractedFrom && selectLayer(layer.content.extractedFrom)}
            onLabelChange={(label) => updateLayerContent(layer.id, { label })}
          />
        )}
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
              <Label className="text-xs">Font</Label>
              <FontSelect
                value={layer.style.fontFamily}
                onChange={(v) => updateLayerStyle(layer.id, { fontFamily: v })}
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
              <Label className="text-xs">Font</Label>
              <FontSelect
                value={layer.style.fontFamily}
                onChange={(v) => updateLayerStyle(layer.id, { fontFamily: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Font size: {layer.style.fontSize ?? 16}</Label>

              <Slider
                min={8} max={120} step={1}
                value={[layer.style.fontSize ?? 16]}
                onValueChange={([v]) => updateLayerStyle(layer.id, { fontSize: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Font weight</Label>
              <Select value={String(layer.style.fontWeight ?? 600)} onValueChange={(v) => updateLayerStyle(layer.id, { fontWeight: Number(v) })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[300, 400, 500, 600, 700, 800].map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
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

        {layer.type === "video" && (
          <div className="space-y-2">
            <Label className="text-xs">Video URL</Label>
            <Input
              className="mt-1"
              value={layer.content.videoUrl || ""}
              placeholder="https://…/clip.mp4"
              onChange={(e) => updateLayerContent(layer.id, { videoUrl: e.target.value })}
            />
            <Label className="text-xs">Poster image URL (optional)</Label>
            <Input
              className="mt-1"
              value={layer.content.posterUrl || ""}
              onChange={(e) => updateLayerContent(layer.id, { posterUrl: e.target.value })}
            />
            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs">Autoplay</Label>
              <Switch
                checked={layer.content.videoAutoplay !== false}
                onCheckedChange={(v) => updateLayerContent(layer.id, { videoAutoplay: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Loop</Label>
              <Switch
                checked={layer.content.videoLoop !== false}
                onCheckedChange={(v) => updateLayerContent(layer.id, { videoLoop: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Muted</Label>
              <Switch
                checked={layer.content.videoMuted !== false}
                onCheckedChange={(v) => updateLayerContent(layer.id, { videoMuted: v })}
              />
            </div>
            <Label className="text-xs">Corner radius</Label>
            <Input
              type="number"
              className="mt-1"
              value={layer.style.cornerRadius ?? 12}
              onChange={(e) => updateLayerStyle(layer.id, { cornerRadius: Number(e.target.value) })}
            />
          </div>
        )}

        {layer.type === "image" && !layer.content.extractedFrom && (
          <div>
            <Label className="text-xs">Image</Label>
            {layer.content.src && (
              <div
                className="mt-1 h-16 w-full rounded border border-border bg-cover bg-center"
                style={{ backgroundImage: `url(${layer.content.src})` }}
              />
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8 w-full text-xs"
              disabled={uploadingImage}
              onClick={() => imageFileRef.current?.click()}
            >
              {uploadingImage ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
              {layer.content.src ? "Replace photo" : "Upload photo"}
            </Button>
            <input
              ref={imageFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadLayerImage(f, layer.id);
              }}
            />
            <Label className="mt-3 block text-xs">Image URL</Label>
            <Input className="mt-1" value={layer.content.src || ""} onChange={(e) => updateLayerContent(layer.id, { src: e.target.value })} />
          </div>
        )}


        {layer.type === "image" && layer.content.extractedFrom && (
          <p className="text-[11px] text-muted-foreground">
            Cutout image is generated from your selection and stored in flyer assets.
          </p>
        )}

        <div>
          <Label className="text-xs">Opacity: {Math.round((layer.style.opacity ?? 1) * 100)}%</Label>
          <Slider min={0} max={100} step={1} value={[Math.round((layer.style.opacity ?? 1) * 100)]} onValueChange={([v]) => updateLayerStyle(layer.id, { opacity: v / 100 })} />
        </div>
      </TabsContent>

      <TabsContent value="action" className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
        {layer.content.extractedFrom && (
          <CutoutLayerBanner
            layer={layer}
            sourceLayer={sourceLayer}
            variant="action"
            onSelectSource={() => layer.content.extractedFrom && selectLayer(layer.content.extractedFrom)}
            onLabelChange={(label) => updateLayerContent(layer.id, { label })}
          />
        )}
        <div className="min-h-0 flex-1">
          <ActionEditor
            action={layer.action ?? null}
            initialType={layer.content.extractedFrom && !layer.action ? "open_url" : undefined}
            onChange={(a) => setLayerAction(layer.id, a)}
          />
        </div>
      </TabsContent>

      <TabsContent value="animation" className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {(() => {
          const usingOverride = !!layer.intro;
          const cfg: PageIntro = layer.intro ?? {
            preset: "none",
            durationMs: 600,
            delayMs: 0,
            stagger: false,
            staggerStepMs: 80,
          };
          function patch(p: Partial<PageIntro>) {
            const next: PageIntro = { ...cfg, ...p };
            setLayerIntro(layer.id, next);
          }
          return (
            <>
              <div className="flex items-start gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-[11px] text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  {usingOverride
                    ? "This layer uses its own animation, overriding the page intro."
                    : "This layer inherits the page-level intro animation. Set a preset below to customize it just for this layer."}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Preset</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={replayIntro}
                >
                  <Play className="mr-1 h-3 w-3" /> Replay
                </Button>
              </div>
              <Select
                value={cfg.preset}
                onValueChange={(v) => {
                  if (v === "inherit") setLayerIntro(layer.id, null);
                  else patch({ preset: v as IntroPreset });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit" className="text-xs">Inherit from page</SelectItem>
                  {INTRO_PRESETS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {usingOverride && cfg.preset !== "none" && (
                <>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label className="text-[11px]">Duration</Label>
                      <span className="text-[11px] text-muted-foreground">{cfg.durationMs ?? 600}ms</span>
                    </div>
                    <Slider
                      min={200}
                      max={2000}
                      step={50}
                      value={[cfg.durationMs ?? 600]}
                      onValueChange={(v) => patch({ durationMs: v[0] })}
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label className="text-[11px]">Delay</Label>
                      <span className="text-[11px] text-muted-foreground">{cfg.delayMs ?? 0}ms</span>
                    </div>
                    <Slider
                      min={0}
                      max={3000}
                      step={50}
                      value={[cfg.delayMs ?? 0]}
                      onValueChange={(v) => patch({ delayMs: v[0] })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Loop animation</Label>
                    <Switch
                      checked={!!cfg.loop}
                      onCheckedChange={(v) => patch({ loop: v })}
                    />
                  </div>

                  {cfg.loop && (
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <Label className="text-[11px]">Loop delay</Label>
                        <span className="text-[11px] text-muted-foreground">{cfg.loopDelayMs ?? 1000}ms</span>
                      </div>
                      <Slider
                        min={0}
                        max={5000}
                        step={100}
                        value={[cfg.loopDelayMs ?? 1000]}
                        onValueChange={(v) => patch({ loopDelayMs: v[0] })}
                      />
                    </div>
                  )}
                </>
              )}

              {usingOverride && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-full text-xs"
                  onClick={() => setLayerIntro(layer.id, null)}
                >
                  Reset to page default
                </Button>
              )}
            </>
          );
        })()}
      </TabsContent>
    </Tabs>
  );
}

function FontSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || DEFAULT_FONT} onValueChange={onChange}>
      <SelectTrigger className="mt-1"><SelectValue placeholder="Font" /></SelectTrigger>
      <SelectContent className="max-h-72">
        {FONT_GROUPS.map((group) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {FONT_OPTIONS.filter((f) => f.group === group).map((f) => (
              <SelectItem key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
