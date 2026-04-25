import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEditorStore } from "@/store/editorStore";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { ElementsPanel } from "@/components/editor/ElementsPanel";
import { Canvas } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { PagesBar } from "@/components/editor/PagesBar";
import { toast } from "@/hooks/use-toast";
import type { Flyer, FlyerPage, Layer } from "@/types/flyer";

export default function Editor() {
  const { flyerId } = useParams<{ flyerId: string }>();
  const setFlyer = useEditorStore((s) => s.setFlyer);
  const pages = useEditorStore((s) => s.pages);
  const flyer = useEditorStore((s) => s.flyer);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load flyer + pages + layers
  useEffect(() => {
    if (!flyerId) return;
    (async () => {
      setLoading(true);
      const { data: f } = await supabase.from("flyers").select("*").eq("id", flyerId).maybeSingle();
      if (!f) {
        setLoading(false);
        return;
      }
      const { data: pgs } = await supabase
        .from("pages")
        .select("*")
        .eq("flyer_id", flyerId)
        .order("index");
      let pagesData = pgs ?? [];

      // create first page if none
      if (pagesData.length === 0) {
        const { data: created } = await supabase
          .from("pages")
          .insert({ flyer_id: flyerId, index: 0, name: "Page 1" })
          .select()
          .single();
        if (created) pagesData = [created];
      }

      const pageIds = pagesData.map((p) => p.id);
      const { data: lyrs } = pageIds.length
        ? await supabase.from("layers").select("*").in("page_id", pageIds)
        : { data: [] as any[] };

      const fullPages: FlyerPage[] = pagesData.map((p) => ({
        id: p.id,
        flyer_id: p.flyer_id,
        index: p.index,
        name: p.name,
        background: p.background as any,
        layers: (lyrs ?? [])
          .filter((l: any) => l.page_id === p.id)
          .map((l: any): Layer => ({
            id: l.id,
            page_id: l.page_id,
            type: l.type,
            position: l.position,
            size: l.size,
            rotation: Number(l.rotation),
            z_index: l.z_index,
            style: l.style,
            content: l.content,
            action: null,
          })),
      }));

      setFlyer(f as unknown as Flyer, fullPages);
      setLoading(false);
    })();
  }, [flyerId, setFlyer]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedLayerIds[0]) {
        e.preventDefault();
        deleteLayer(selectedLayerIds[0]);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedLayerIds[0]) {
        e.preventDefault();
        duplicateLayer(selectedLayerIds[0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteLayer, duplicateLayer, selectedLayerIds]);

  const handleSave = async () => {
    if (!flyer) return;
    setSaving(true);
    try {
      // Upsert pages
      for (const page of pages) {
        await supabase.from("pages").upsert({
          id: page.id,
          flyer_id: flyer.id,
          index: page.index,
          name: page.name,
          background: page.background,
        });
      }
      // Delete pages no longer in store
      const { data: existingPages } = await supabase
        .from("pages")
        .select("id")
        .eq("flyer_id", flyer.id);
      const keepPageIds = new Set(pages.map((p) => p.id));
      const toDeletePages = (existingPages ?? []).filter((p) => !keepPageIds.has(p.id));
      if (toDeletePages.length) {
        await supabase.from("pages").delete().in("id", toDeletePages.map((p) => p.id));
      }

      // Replace layers per page (simple strategy: delete + insert)
      for (const page of pages) {
        await supabase.from("layers").delete().eq("page_id", page.id);
        if (page.layers.length) {
          await supabase.from("layers").insert(
            page.layers.map((l) => ({
              id: l.id,
              page_id: page.id,
              type: l.type,
              position: l.position,
              size: l.size,
              rotation: l.rotation,
              z_index: l.z_index,
              style: l.style,
              content: l.content,
            })),
          );
        }
      }

      await supabase.from("flyers").update({ updated_at: new Date().toISOString() }).eq("id", flyer.id);
      toast({ title: "Saved", description: "Your flyer has been saved." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading editor…</div>
      </div>
    );
  }

  if (!flyer) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Flyer not found.</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <EditorToolbar onSave={handleSave} saving={saving} flyerId={flyer.id} />
      <div className="flex flex-1 overflow-hidden">
        <ElementsPanel />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Canvas />
          </div>
          <PagesBar />
        </div>
        <Inspector />
      </div>
    </div>
  );
}
