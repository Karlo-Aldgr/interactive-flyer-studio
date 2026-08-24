import { useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Copy, Trash2, ChevronUp, ChevronDown, Sparkles, Play, MousePointerClick, Camera, Loader2, UtensilsCrossed, IdCard, Globe, Monitor, Tablet, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { IntroPreset, PageIntro } from "@/types/flyer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PRESET_OPTIONS: { value: IntroPreset; label: string }[] = [
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

export function PagesPanel() {
  const flyer = useEditorStore((s) => s.flyer);
  const setFlyer = useEditorStore((s) => s.setFlyer);
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectPage = useEditorStore((s) => s.selectPage);
  const addPage = useEditorStore((s) => s.addPage);
  const addLandingPage = useEditorStore((s) => s.addLandingPage);
  const addScannedMenuPage = useEditorStore((s) => s.addScannedMenuPage);
  const addWebsitePage = useEditorStore((s) => s.addWebsitePage);
  const setWebsiteDevice = useEditorStore((s) => s.setWebsiteDevice);

  const setPageSize = useEditorStore((s) => s.setPageSize);
  const deletePage = useEditorStore((s) => s.deletePage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const setPageIntro = useEditorStore((s) => s.setPageIntro);
  const setPageBackground = useEditorStore((s) => s.setPageBackground);
  const setPageBackgroundImage = useEditorStore((s) => s.setPageBackgroundImage);
  const applyIntroToAllPages = useEditorStore((s) => s.applyIntroToAllPages);
  const replayIntro = useEditorStore((s) => s.replayIntro);
  const setPageLink = useEditorStore((s) => s.setPageLink);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [uploadingBg, setUploadingBg] = useState(false);

  async function uploadBackground(file: File) {
    const pageId = selectedPageId;
    if (!flyer || !pageId) return;
    if (!user) { toast.error("Sign in required"); return; }
    setUploadingBg(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${flyer.id}/bg-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("flyer-assets").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
      setPageBackgroundImage(pageId, data.publicUrl);
      toast.success("Background image added");
    } catch (e: any) {
      toast.error(e?.message || "Could not upload background");
    } finally {
      setUploadingBg(false);
    }
  }


  async function handleScanMenu(file: File) {
    if (!flyer) return;
    if (!user) { toast.error("Sign in required"); return; }
    setScanning(true);
    try {
      const safeName = file.name.replace(/[^a-z0-9.]/gi, "_");
      const path = `${user.id}/${flyer.id}/menu-scan/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("flyer-assets").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("flyer-assets").getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      // Read intrinsic image dimensions
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Could not load image"));
        img.src = imageUrl;
      });

      const { data, error } = await supabase.functions.invoke("menu-scan", { body: { imageUrl } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const scanned = (data?.sections || []) as any[];
      const flatItems = scanned.flatMap((s: any) => (s.items || []));
      if (flatItems.length === 0) {
        toast.warning("No items detected. Try a clearer, straighter photo.");
        return;
      }
      addScannedMenuPage({
        imageUrl,
        imgWidth: dims.w,
        imgHeight: dims.h,
        items: flatItems,
      });

      // Merge scanned sections into flyer.settings.menuCatalog so taps can show upsells.
      const existing = (flyer.settings as any).menuCatalog || { sections: [], currency: "$", title: "Order", checkoutMode: "order_only" };
      const merged = {
        ...existing,
        sections: [...(existing.sections || []), ...scanned],
      };
      setFlyer({ settings: { ...flyer.settings, menuCatalog: merged } as any });

      toast.success(`Added menu page with ${flatItems.length} tappable item${flatItems.length > 1 ? "s" : ""}.`);
    } catch (e: any) {
      toast.error(e?.message || "Could not scan menu");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function move(id: string, dir: -1 | 1) {
    const idx = pages.findIndex((p) => p.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pages.length) return;
    const ids = pages.map((p) => p.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    reorderPages(ids);
  }

  const activePage = pages.find((p) => p.id === selectedPageId);
  const intro: PageIntro = activePage?.intro ?? {
    preset: "none",
    durationMs: 600,
    delayMs: 0,
    stagger: false,
    staggerStepMs: 80,
  };

  function patchIntro(patch: Partial<PageIntro>) {
    if (!activePage) return;
    const next: PageIntro = { ...intro, ...patch };
    setPageIntro(activePage.id, next.preset === "none" && !patch.preset ? next : next);
  }


  return (
    <div className="flex flex-col border-b border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Pages</span>
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScanMenu(f); }} />
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Scan menu photo into new page"
            disabled={scanning} onClick={() => fileRef.current?.click()}>
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6" title="Add page">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={addPage}>Add flyer page</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addLandingPage(1200, 630)}>
                Add landing page (1200×630)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addLandingPage(1080, 1080)}>
                Add square page (1080×1080)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addLandingPage(1080, 1920)}>
                Add story page (1080×1920)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addWebsitePage()}>
                <Globe className="mr-2 h-3.5 w-3.5" /> Add website page
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem disabled={scanning} onClick={() => fileRef.current?.click()}>
                <Camera className="mr-2 h-3.5 w-3.5" /> {scanning ? "Scanning…" : "Scan menu photo"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {(() => { let flyerCount = 0; return pages.map((p, i) => {
          const isBizad = !!p.background?.bizadPage;
          const isWebsite = !!p.background?.websitePage;
          const isLanding = !isBizad && !isWebsite && !!p.background?.linkPageId;
          if (!isLanding && !isBizad && !isWebsite) flyerCount += 1;
          const label = isBizad ? "B" : isWebsite ? "W" : isLanding ? "L" : String(flyerCount);
          const active = p.id === selectedPageId;
          const editing = editingId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => selectPage(p.id)}
              className={`group flex items-center gap-2 border-b border-border px-3 py-2 text-sm cursor-pointer ${active ? "bg-primary/10" : "hover:bg-muted/60"}`}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold"
                title={isBizad ? "Digital business card page (editor only)" : isWebsite ? "Website page (long scrolling)" : isLanding ? "Landing page (not counted)" : `Page ${flyerCount}`}
              >
                {isBizad ? <IdCard className="h-3.5 w-3.5" /> : isWebsite ? <Globe className="h-3.5 w-3.5" /> : label}
              </span>

              {editing ? (
                <Input
                  autoFocus
                  className="h-6 flex-1 text-xs"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => { renamePage(p.id, editValue || p.name); setEditingId(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { renamePage(p.id, editValue || p.name); setEditingId(null); }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <span
                  className={`flex-1 truncate ${isBizad && p.background?.bizadHidden ? "text-muted-foreground line-through" : ""}`}
                  title={isBizad && p.background?.bizadHidden ? "Card is turned off — enable it in the Digital business card dialog" : undefined}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditValue(p.name); }}
                >
                  {p.name}
                </span>
              )}
              <div className="flex opacity-0 group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); move(p.id, -1); }} disabled={i === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); move(p.id, 1); }} disabled={i === pages.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }} title="Duplicate">
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  disabled={pages.length <= 1}
                  onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        }); })()}
      </div>

      {activePage && (
        <div className="space-y-3 border-t border-border bg-muted/20 p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Page background</div>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={activePage.background.color || "#ffffff"}
              onChange={(e) => setPageBackground(activePage.id, e.target.value)}
            />
            <Input
              type="text"
              className="h-9 flex-1 text-xs"
              value={activePage.background.color || "#ffffff"}
              onChange={(e) => setPageBackground(activePage.id, e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground">Background image</div>
            {activePage.background.image && (
              <div
                className="h-16 w-full rounded border border-border bg-cover bg-center"
                style={{ backgroundImage: `url(${activePage.background.image})` }}
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 text-xs"
                disabled={uploadingBg}
                onClick={() => bgFileRef.current?.click()}
              >
                {uploadingBg ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                {activePage.background.image ? "Replace" : "Upload image"}
              </Button>
              {activePage.background.image && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-destructive"
                  onClick={() => setPageBackgroundImage(activePage.id, null)}
                >
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadBackground(f);
              }}
            />
          </div>
        </div>
      )}

      {activePage && flyer && (
        <PageSizeSection
          pageId={activePage.id}
          currentW={activePage.background?.size?.width ?? flyer.settings.width}
          currentH={activePage.background?.size?.height ?? flyer.settings.height}
          isOverride={!!activePage.background?.size}
          flyerW={flyer.settings.width}
          flyerH={flyer.settings.height}
          setPageSize={setPageSize}
        />
      )}

      {activePage && pages.length > 1 && (
        <div className="space-y-2 border-t border-border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            Tap anywhere → go to page
          </div>
          <p className="text-[11px] text-muted-foreground">
            When set, tapping anywhere on this page navigates to the chosen page.
            Useful for landing pages that link straight into the flyer.
          </p>
          <Select
            value={activePage.background?.linkPageId ?? "__none__"}
            onValueChange={(v) => setPageLink(activePage.id, v === "__none__" ? null : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Don't link" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">Don't link (normal page)</SelectItem>
              {pages
                .filter((p) => p.id !== activePage.id)
                .map((p, i) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {activePage && (
        <div className="space-y-3 border-t border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Intro animation
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={replayIntro}
              disabled={intro.preset === "none"}
              title="Replay"
            >
              <Play className="mr-1 h-3 w-3" /> Replay
            </Button>
          </div>

          <div>
            <Label className="text-[11px]">Preset</Label>
            <Select
              value={intro.preset}
              onValueChange={(v) => patchIntro({ preset: v as IntroPreset })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {intro.preset !== "none" && (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-[11px]">Duration</Label>
                  <span className="text-[11px] text-muted-foreground">{intro.durationMs ?? 600}ms</span>
                </div>
                <Slider
                  min={200}
                  max={2000}
                  step={50}
                  value={[intro.durationMs ?? 600]}
                  onValueChange={(v) => patchIntro({ durationMs: v[0] })}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-[11px]">Delay</Label>
                  <span className="text-[11px] text-muted-foreground">{intro.delayMs ?? 0}ms</span>
                </div>
                <Slider
                  min={0}
                  max={2000}
                  step={50}
                  value={[intro.delayMs ?? 0]}
                  onValueChange={(v) => patchIntro({ delayMs: v[0] })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Stagger layers</Label>
                <Switch
                  checked={!!intro.stagger}
                  onCheckedChange={(v) => patchIntro({ stagger: v })}
                />
              </div>

              {intro.stagger && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-[11px]">Stagger step</Label>
                    <span className="text-[11px] text-muted-foreground">{intro.staggerStepMs ?? 80}ms</span>
                  </div>
                  <Slider
                    min={20}
                    max={400}
                    step={10}
                    value={[intro.staggerStepMs ?? 80]}
                    onValueChange={(v) => patchIntro({ staggerStepMs: v[0] })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Loop animation</Label>
                <Switch
                  checked={!!intro.loop}
                  onCheckedChange={(v) => patchIntro({ loop: v })}
                />
              </div>

              {intro.loop && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-[11px]">Loop delay</Label>
                    <span className="text-[11px] text-muted-foreground">{intro.loopDelayMs ?? 1000}ms</span>
                  </div>
                  <Slider
                    min={0}
                    max={5000}
                    step={100}
                    value={[intro.loopDelayMs ?? 1000]}
                    onValueChange={(v) => patchIntro({ loopDelayMs: v[0] })}
                  />
                </div>
              )}
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-7 w-full text-xs"
            onClick={() => applyIntroToAllPages(intro)}
          >
            Apply to all pages
          </Button>
        </div>
      )}

      {flyer && (flyer.settings as any)?.menuCatalog && (
        <div className="border-t border-border p-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-full text-xs">
                <UtensilsCrossed className="mr-1 h-3.5 w-3.5" /> Edit menu items
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
              <DialogHeader className="px-4 pt-4">
                <DialogTitle>Menu items</DialogTitle>
              </DialogHeader>
              <MenuCatalogEditor
                catalog={(flyer.settings as any).menuCatalog}
                onChange={(next) => setFlyer({ settings: { ...flyer.settings, menuCatalog: next } as any })}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

function MenuCatalogEditor({ catalog, onChange }: { catalog: any; onChange: (next: any) => void }) {
  const sections: any[] = catalog?.sections || [];
  const currency = catalog?.currency || "$";

  function update(next: Partial<any>) {
    onChange({ ...catalog, ...next });
  }
  function updateSections(nextSections: any[]) {
    update({ sections: nextSections });
  }
  function updateItem(si: number, ii: number, patch: any) {
    const next = sections.map((s, i) => i !== si ? s : { ...s, items: s.items.map((it: any, j: number) => j !== ii ? it : { ...it, ...patch }) });
    updateSections(next);
  }
  function removeItem(si: number, ii: number) {
    const next = sections.map((s, i) => i !== si ? s : { ...s, items: s.items.filter((_: any, j: number) => j !== ii) });
    updateSections(next);
  }
  function addItem(si: number) {
    const next = sections.map((s, i) => i !== si ? s : { ...s, items: [...(s.items || []), { id: `it_${Date.now()}`, name: "New item", price: 0, category: "other" }] });
    updateSections(next);
  }
  function renameSection(si: number, name: string) {
    updateSections(sections.map((s, i) => i !== si ? s : { ...s, name }));
  }
  function removeSection(si: number) {
    updateSections(sections.filter((_, i) => i !== si));
  }
  function addSection() {
    updateSections([...sections, { id: `sec_${Date.now()}`, name: "New section", items: [] }]);
  }

  return (
    <div className="space-y-3 border-t border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Menu items</div>
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-12 text-xs"
            value={currency}
            onChange={(e) => update({ currency: e.target.value })}
            title="Currency symbol"
          />
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={addSection}>
            <Plus className="mr-1 h-3 w-3" /> Section
          </Button>
        </div>
      </div>

      {sections.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No items yet. Scan a menu photo or add a section.</p>
      )}

      <div className="space-y-3">
        {sections.map((sec, si) => (
          <div key={sec.id || si} className="rounded border border-border bg-background p-2 space-y-2">
            <div className="flex items-center gap-1">
              <Input
                className="h-7 flex-1 text-xs font-medium"
                value={sec.name || ""}
                onChange={(e) => renameSection(si, e.target.value)}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSection(si)} title="Remove section">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {(sec.items || []).map((it: any, ii: number) => (
                <div key={it.id || ii} className="flex items-center gap-1">
                  <Input
                    className="h-7 flex-1 text-xs"
                    value={it.name || ""}
                    placeholder="Item name"
                    onChange={(e) => updateItem(si, ii, { name: e.target.value })}
                  />
                  <Input
                    className="h-7 w-16 text-xs"
                    type="number"
                    step="0.01"
                    value={it.price ?? 0}
                    onChange={(e) => updateItem(si, ii, { price: Number(e.target.value) || 0 })}
                  />
                  <Select value={it.category || "other"} onValueChange={(v) => updateItem(si, ii, { category: v })}>
                    <SelectTrigger className="h-7 w-20 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main" className="text-xs">Main</SelectItem>
                      <SelectItem value="side" className="text-xs">Side</SelectItem>
                      <SelectItem value="drink" className="text-xs">Drink</SelectItem>
                      <SelectItem value="dessert" className="text-xs">Dessert</SelectItem>
                      <SelectItem value="other" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(si, ii)} title="Remove">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" className="h-7 w-full justify-start text-[11px]" onClick={() => addItem(si)}>
                <Plus className="mr-1 h-3 w-3" /> Add item
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground leading-tight">
        Edits affect the cart & upsell list. Hotspots on scanned pages keep their original item — remove the hotspot layer to disable tapping.
      </p>
    </div>
  );
}

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Landing 1200×630", w: 1200, h: 630 },
  { label: "Square 1080×1080", w: 1080, h: 1080 },
  { label: "Story 1080×1920", w: 1080, h: 1920 },
  { label: "Flyer 900×1200", w: 900, h: 1200 },
];

function PageSizeSection({
  pageId, currentW, currentH, isOverride, flyerW, flyerH, setPageSize,
}: {
  pageId: string;
  currentW: number;
  currentH: number;
  isOverride: boolean;
  flyerW: number;
  flyerH: number;
  setPageSize: (id: string, w: number, h: number, mode: "resize" | "scale" | "crop") => void;
}) {
  const [w, setW] = useState(currentW);
  const [h, setH] = useState(currentH);
  const [mode, setMode] = useState<"resize" | "scale" | "crop">("scale");

  return (
    <div className="space-y-3 border-t border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Page size</span>
        {isOverride ? (
          <span className="text-[10px] uppercase tracking-wide text-primary">Custom</span>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Flyer default</span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-[11px]">W</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            value={w}
            onChange={(e) => setW(Math.max(50, Number(e.target.value) || 0))}
          />
        </div>
        <div className="flex-1">
          <Label className="text-[11px]">H</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            value={h}
            onChange={(e) => setH(Math.max(50, Number(e.target.value) || 0))}
          />
        </div>
      </div>

      <div>
        <Label className="text-[11px]">When resizing</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as any)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resize" className="text-xs">Resize canvas only</SelectItem>
            <SelectItem value="scale" className="text-xs">Scale layers</SelectItem>
            <SelectItem value="crop" className="text-xs">Crop to size</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        size="sm"
        className="h-8 w-full text-xs"
        onClick={() => setPageSize(pageId, w, h, mode)}
        disabled={w === currentW && h === currentH}
      >
        Apply size
      </Button>

      <div className="flex flex-wrap gap-1">
        {SIZE_PRESETS.map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={() => { setW(p.w); setH(p.h); setPageSize(pageId, p.w, p.h, mode); }}
          >
            {p.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px]"
          onClick={() => setPageSize(pageId, flyerW, flyerH, mode)}
          disabled={!isOverride}
          title="Use the flyer's default size"
        >
          Use flyer default
        </Button>
      </div>
    </div>
  );
}
