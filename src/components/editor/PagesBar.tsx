import { Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PagesBar() {
  const pages = useEditorStore((s) => s.pages);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);
  const addPage = useEditorStore((s) => s.addPage);
  const deletePage = useEditorStore((s) => s.deletePage);

  return (
    <div className="flex items-center gap-2 border-t bg-card px-4 py-2 overflow-x-auto">
      {pages.map((p, i) => (
        <button
          key={p.id}
          onClick={() => setCurrentPage(p.id)}
          className={cn(
            "group relative flex h-14 w-20 shrink-0 flex-col items-center justify-center rounded-lg border text-xs font-medium transition",
            currentPageId === p.id
              ? "border-primary bg-primary/5 text-primary shadow-sm"
              : "border-border bg-background hover:border-primary/40",
          )}
        >
          <span className="text-[10px] text-muted-foreground">Page</span>
          <span>{i + 1}</span>
          {pages.length > 1 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                deletePage(p.id);
              }}
              className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
            >
              <Trash2 className="h-3 w-3" />
            </span>
          )}
        </button>
      ))}
      <Button variant="outline" size="sm" onClick={addPage} className="shrink-0">
        <Plus className="mr-1 h-4 w-4" /> Add page
      </Button>
    </div>
  );
}
