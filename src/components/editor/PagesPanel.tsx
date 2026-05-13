import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Copy, Trash2, ChevronUp, ChevronDown, Sparkles, Play } from "lucide-react";
import type { IntroPreset, PageIntro } from "@/types/flyer";

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
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectPage = useEditorStore((s) => s.selectPage);
  const addPage = useEditorStore((s) => s.addPage);
  const addLandingPage = useEditorStore((s) => s.addLandingPage);
  const setPageSize = useEditorStore((s) => s.setPageSize);
  const deletePage = useEditorStore((s) => s.deletePage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const setPageIntro = useEditorStore((s) => s.setPageIntro);
  const setPageBackground = useEditorStore((s) => s.setPageBackground);
  const applyIntroToAllPages = useEditorStore((s) => s.applyIntroToAllPages);
  const replayIntro = useEditorStore((s) => s.replayIntro);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addPage} title="Add page">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {pages.map((p, i) => {
          const active = p.id === selectedPageId;
          const editing = editingId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => selectPage(p.id)}
              className={`group flex items-center gap-2 border-b border-border px-3 py-2 text-sm cursor-pointer ${active ? "bg-primary/10" : "hover:bg-muted/60"}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold">
                {i + 1}
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
                  className="flex-1 truncate"
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
        })}
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
    </div>
  );
}
