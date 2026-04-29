import { Link } from "react-router-dom";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Undo2, Redo2, Plus, X, Eye, Globe, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props { saving: boolean }

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 7);
}

export function TopBar({ saving }: Props) {
  const flyer = useEditorStore((s) => s.flyer);
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectPage = useEditorStore((s) => s.selectPage);
  const addPage = useEditorStore((s) => s.addPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const setFlyer = useEditorStore((s) => s.setFlyer);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past.length);
  const future = useEditorStore((s) => s.future.length);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  if (!flyer) return null;

  async function togglePublish() {
    if (!flyer) return;
    const newStatus = flyer.status === "published" ? "draft" : "published";
    let slug = flyer.public_slug;
    if (newStatus === "published" && !slug) {
      slug = slugify(flyer.title || "flyer");
    }
    setFlyer({ status: newStatus, public_slug: slug });
    const { error } = await supabase.from("flyers").update({ status: newStatus, public_slug: slug }).eq("id", flyer.id);
    if (error) toast.error(error.message);
    else toast.success(newStatus === "published" ? "Published!" : "Unpublished");
  }

  function copyLink() {
    if (!flyer?.public_slug) return;
    navigator.clipboard.writeText(`${window.location.origin}/f/${flyer.public_slug}`);
    toast.success("Public link copied");
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-3">
      <Button asChild variant="ghost" size="sm">
        <Link to="/dashboard"><ChevronLeft className="mr-1 h-4 w-4" />Dashboard</Link>
      </Button>
      <Input
        className="h-8 max-w-xs border-transparent bg-transparent font-semibold focus-visible:border-input"
        value={flyer.title}
        onChange={(e) => setFlyer({ title: e.target.value })}
      />
      <div className="ml-2 flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} disabled={!past}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} disabled={!future}>
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="ml-4 flex items-center gap-1 overflow-x-auto">
        {pages.map((p, i) => (
          <div
            key={p.id}
            className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer ${p.id === selectedPageId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => selectPage(p.id)}
          >
            <span>{i + 1}</span>
            {pages.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}
                className="opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={addPage}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(zoom - 0.1)}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(zoom + 0.1)}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {saving ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving...</span> : "Saved"}
        </span>
        <Button asChild size="sm" variant="outline">
          <a href={`/preview/${flyer.id}`} target="_blank" rel="noreferrer"><Eye className="mr-1 h-4 w-4" />Preview</a>
        </Button>
        {flyer.status === "published" && (
          <Button size="sm" variant="outline" onClick={copyLink}>Copy link</Button>
        )}
        <Button size="sm" onClick={togglePublish} className={flyer.status === "published" ? "" : "shadow-glow"}>
          <Globe className="mr-1 h-4 w-4" />
          {flyer.status === "published" ? "Unpublish" : "Publish"}
        </Button>
      </div>
    </header>
  );
}
