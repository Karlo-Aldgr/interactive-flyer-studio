import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export function PagesPanel() {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectPage = useEditorStore((s) => s.selectPage);
  const addPage = useEditorStore((s) => s.addPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const reorderPages = useEditorStore((s) => s.reorderPages);

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
    </div>
  );
}
