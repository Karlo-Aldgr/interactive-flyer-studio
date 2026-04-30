import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEditorStore } from "@/store/editorStore";
import { Flyer, FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { toast } from "sonner";
import { generateAndUploadThumbnail } from "@/lib/thumbnail";

export function useFlyerData(flyerId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const hydrate = useEditorStore((s) => s.hydrate);
  const flyer = useEditorStore((s) => s.flyer);
  const pages = useEditorStore((s) => s.pages);
  const dirty = useEditorStore((s) => s.dirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const lastSnapshot = useRef<string>("");
  const [saving, setSaving] = useState(false);

  // Load
  useEffect(() => {
    if (!flyerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: f, error } = await supabase.from("flyers").select("*").eq("id", flyerId).single();
      if (error || !f) {
        toast.error("Could not load flyer");
        setLoading(false);
        return;
      }
      const { data: pgs } = await supabase
        .from("pages")
        .select("*, layers(*, actions(*))")
        .eq("flyer_id", flyerId)
        .order("index", { ascending: true });

      const mapped: FlyerPage[] = (pgs ?? []).map((p: any) => ({
        id: p.id,
        flyer_id: p.flyer_id,
        index: p.index,
        name: p.name,
        background: p.background ?? { color: "#ffffff" },
        intro: p.intro ?? null,
        layers: (p.layers ?? [])
          .sort((a: any, b: any) => a.z_index - b.z_index)
          .map((l: any) => ({
            id: l.id,
            page_id: l.page_id,
            type: l.type,
            position: l.position,
            size: l.size,
            rotation: Number(l.rotation) || 0,
            z_index: l.z_index,
            style: l.style ?? {},
            content: l.content ?? {},
            intro: l.intro ?? null,
            action: l.actions?.[0]
              ? ({ id: l.actions[0].id, type: l.actions[0].type, payload: l.actions[0].payload, highlight: l.actions[0].highlight ?? undefined } as LayerAction)
              : null,
          })),
      }));

      // Ensure at least one page
      if (mapped.length === 0) {
        const { data: np } = await supabase
          .from("pages")
          .insert([{ flyer_id: flyerId, index: 0, name: "Page 1" }])
          .select()
          .single();
        if (np) {
          mapped.push({
            id: np.id, flyer_id: np.flyer_id, index: 0, name: np.name,
            background: (np.background as any) ?? { color: "#ffffff" }, layers: [],
          });
        }
      }
      if (cancelled) return;
      hydrate(f as unknown as Flyer, mapped);
      lastSnapshot.current = JSON.stringify({ flyer: f, pages: mapped });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [flyerId, hydrate]);

  // Autosave
  const lastThumbAt = useRef<number>(0);
  useEffect(() => {
    if (!flyer || loading) return;
    if (!dirty) return;
    const handle = setTimeout(async () => {
      await save(flyer, pages);
      markSaved();
      // Regenerate the social thumbnail at most every 15s while the flyer is published.
      if (flyer.status === "published") {
        const now = Date.now();
        if (now - lastThumbAt.current > 15000) {
          lastThumbAt.current = now;
          const stage = useEditorStore.getState().stageRef;
          // Switch to first page momentarily isn't needed — we render the active stage.
          // For social previews we want page 1, so we render whatever is currently shown
          // only if it's the first page; otherwise we skip and rely on publish-time capture.
          const firstPageId = pages[0]?.id;
          const selectedPageId = useEditorStore.getState().selectedPageId;
          if (stage && firstPageId && selectedPageId === firstPageId) {
            generateAndUploadThumbnail(
              stage,
              flyer.id,
              flyer.settings.width,
              flyer.settings.height,
              pages[0].background?.color || flyer.settings.background || "#ffffff"
            ).catch((e) => console.warn("[autosave thumbnail] failed", e));
          }
        }
      }
    }, 800);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, flyer, dirty]);

  async function save(f: Flyer, currentPages: FlyerPage[]) {
    setSaving(true);
    try {
      // 1. Update flyer meta
      await supabase
        .from("flyers")
        .update({
          title: f.title,
          status: f.status,
          public_slug: f.public_slug,
          settings: f.settings as any,
        })
        .eq("id", f.id);

      // 2. Fetch current DB state to diff
      const { data: dbPages } = await supabase
        .from("pages")
        .select("id, layers(id)")
        .eq("flyer_id", f.id);

      const dbPageIds = new Set((dbPages ?? []).map((p: any) => p.id));
      const dbLayerIds = new Set((dbPages ?? []).flatMap((p: any) => (p.layers ?? []).map((l: any) => l.id)));
      const currentPageIds = new Set(currentPages.map((p) => p.id));
      const currentLayerIds = new Set(currentPages.flatMap((p) => p.layers.map((l) => l.id)));

      // 3. Delete removed pages (cascade not assumed → also delete layers manually)
      const pagesToDelete = [...dbPageIds].filter((id) => !currentPageIds.has(id));
      if (pagesToDelete.length) {
        await supabase.from("layers").delete().in("page_id", pagesToDelete);
        await supabase.from("pages").delete().in("id", pagesToDelete);
      }

      // 4. Delete removed layers
      const layersToDelete = [...dbLayerIds].filter((id) => !currentLayerIds.has(id));
      if (layersToDelete.length) {
        await supabase.from("actions").delete().in("layer_id", layersToDelete);
        await supabase.from("layers").delete().in("id", layersToDelete);
      }

      // 5. Upsert pages
      const pageRows = currentPages.map((p) => ({
        id: p.id,
        flyer_id: f.id,
        index: p.index,
        name: p.name,
        background: p.background as any,
        intro: (p.intro ?? null) as any,
      }));
      if (pageRows.length) {
        await supabase.from("pages").upsert(pageRows);
      }

      // 6. Upsert layers
      const allLayers: Layer[] = currentPages.flatMap((p) => p.layers);
      if (allLayers.length) {
        const layerRows = allLayers.map((l) => ({
          id: l.id,
          page_id: l.page_id,
          type: l.type,
          position: l.position as any,
          size: l.size as any,
          rotation: l.rotation,
          z_index: l.z_index,
          style: l.style as any,
          content: l.content as any,
          intro: (l.intro ?? null) as any,
        }));
        await supabase.from("layers").upsert(layerRows);
      }

      // 7. Upsert / delete actions
      const layersWithAction = allLayers.filter((l) => l.action);
      const layersWithoutAction = allLayers.filter((l) => !l.action).map((l) => l.id);
      if (layersWithoutAction.length) {
        await supabase.from("actions").delete().in("layer_id", layersWithoutAction);
      }
      for (const l of layersWithAction) {
        if (!l.action) continue;
        // Upsert by layer_id (delete then insert is simpler given no unique constraint)
        await supabase.from("actions").delete().eq("layer_id", l.id);
        await supabase.from("actions").insert([{
          layer_id: l.id,
          type: l.action.type,
          payload: l.action.payload as any,
          highlight: (l.action.highlight ?? null) as any,
        }]);
      }
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return { loading, saving };
}
