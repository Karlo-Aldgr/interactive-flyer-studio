import { create } from "zustand";
import type { Flyer, FlyerPage, Layer, LayerType } from "@/types/flyer";

type Snapshot = { pages: FlyerPage[] };

interface EditorState {
  flyer: Flyer | null;
  pages: FlyerPage[];
  currentPageId: string | null;
  selectedLayerIds: string[];
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  history: Snapshot[];
  future: Snapshot[];

  // setup
  setFlyer: (flyer: Flyer, pages: FlyerPage[]) => void;
  setCurrentPage: (id: string) => void;

  // selection
  selectLayer: (id: string | null, additive?: boolean) => void;
  clearSelection: () => void;

  // viewport
  setZoom: (z: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;

  // layer mutations (with history)
  addLayer: (type: LayerType, partial?: Partial<Layer>) => Layer | null;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  updateLayerStyle: (id: string, patch: Partial<Layer["style"]>) => void;
  updateLayerContent: (id: string, patch: Partial<Layer["content"]>) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayer: (id: string, direction: "up" | "down" | "top" | "bottom") => void;

  // pages
  addPage: () => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;

  // history
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const HISTORY_LIMIT = 50;
const uid = () => crypto.randomUUID();

const cloneSnapshot = (pages: FlyerPage[]): Snapshot => ({
  pages: JSON.parse(JSON.stringify(pages)),
});

export const useEditorStore = create<EditorState>((set, get) => ({
  flyer: null,
  pages: [],
  currentPageId: null,
  selectedLayerIds: [],
  zoom: 0.6,
  showGrid: true,
  snapToGrid: true,
  gridSize: 20,
  history: [],
  future: [],

  setFlyer: (flyer, pages) =>
    set({
      flyer,
      pages,
      currentPageId: pages[0]?.id ?? null,
      selectedLayerIds: [],
      history: [],
      future: [],
    }),

  setCurrentPage: (id) => set({ currentPageId: id, selectedLayerIds: [] }),

  selectLayer: (id, additive = false) =>
    set((s) => {
      if (id === null) return { selectedLayerIds: [] };
      if (additive) {
        return {
          selectedLayerIds: s.selectedLayerIds.includes(id)
            ? s.selectedLayerIds.filter((x) => x !== id)
            : [...s.selectedLayerIds, id],
        };
      }
      return { selectedLayerIds: [id] };
    }),
  clearSelection: () => set({ selectedLayerIds: [] }),

  setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(2, z)) }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  pushHistory: () =>
    set((s) => {
      const snap = cloneSnapshot(s.pages);
      const next = [...s.history, snap];
      if (next.length > HISTORY_LIMIT) next.shift();
      return { history: next, future: [] };
    }),

  addLayer: (type, partial) => {
    const { currentPageId, pages } = get();
    if (!currentPageId) return null;
    get().pushHistory();
    const page = pages.find((p) => p.id === currentPageId);
    if (!page) return null;
    const maxZ = page.layers.reduce((m, l) => Math.max(m, l.z_index), 0);

    const defaults: Record<LayerType, Partial<Layer>> = {
      text: {
        size: { width: 320, height: 60 },
        content: { text: "Double-click to edit" },
        style: { fontSize: 32, fontWeight: 700, color: "#1a1033", align: "left", fontFamily: "Plus Jakarta Sans" },
      },
      image: {
        size: { width: 240, height: 240 },
        content: { src: "" },
        style: { cornerRadius: 12 },
      },
      icon: {
        size: { width: 80, height: 80 },
        content: { iconName: "Star" },
        style: { color: "#7c3aed" },
      },
      shape: {
        size: { width: 200, height: 200 },
        content: { shape: "rect" },
        style: { fill: "#a78bfa", cornerRadius: 16, shape: "rect" },
      },
      button: {
        size: { width: 220, height: 64 },
        content: { label: "Click me" },
        style: { fill: "#7c3aed", color: "#ffffff", cornerRadius: 999, fontSize: 18, fontWeight: 700, align: "center" },
      },
    };

    const base = defaults[type];
    const layer: Layer = {
      id: uid(),
      page_id: currentPageId,
      type,
      position: { x: 100, y: 100 },
      size: base.size as Layer["size"],
      rotation: 0,
      z_index: maxZ + 1,
      style: base.style ?? {},
      content: base.content ?? {},
      action: null,
      ...partial,
    };

    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === currentPageId ? { ...p, layers: [...p.layers, layer] } : p,
      ),
      selectedLayerIds: [layer.id],
    }));
    return layer;
  },

  updateLayer: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      })),
    })),

  updateLayerStyle: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) =>
          l.id === id ? { ...l, style: { ...l.style, ...patch } } : l,
        ),
      })),
    })),

  updateLayerContent: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) =>
          l.id === id ? { ...l, content: { ...l.content, ...patch } } : l,
        ),
      })),
    })),

  deleteLayer: (id) => {
    get().pushHistory();
    set((s) => ({
      pages: s.pages.map((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) })),
      selectedLayerIds: s.selectedLayerIds.filter((x) => x !== id),
    }));
  },

  duplicateLayer: (id) => {
    get().pushHistory();
    set((s) => {
      let newId: string | null = null;
      const pages = s.pages.map((p) => {
        const src = p.layers.find((l) => l.id === id);
        if (!src) return p;
        newId = uid();
        const clone: Layer = {
          ...JSON.parse(JSON.stringify(src)),
          id: newId,
          position: { x: src.position.x + 24, y: src.position.y + 24 },
          z_index: Math.max(...p.layers.map((l) => l.z_index)) + 1,
        };
        return { ...p, layers: [...p.layers, clone] };
      });
      return { pages, selectedLayerIds: newId ? [newId] : s.selectedLayerIds };
    });
  },

  reorderLayer: (id, direction) => {
    get().pushHistory();
    set((s) => ({
      pages: s.pages.map((p) => {
        if (!p.layers.find((l) => l.id === id)) return p;
        const sorted = [...p.layers].sort((a, b) => a.z_index - b.z_index);
        const idx = sorted.findIndex((l) => l.id === id);
        if (idx < 0) return p;
        const target =
          direction === "top" ? sorted.length - 1
          : direction === "bottom" ? 0
          : direction === "up" ? Math.min(sorted.length - 1, idx + 1)
          : Math.max(0, idx - 1);
        const [item] = sorted.splice(idx, 1);
        sorted.splice(target, 0, item);
        const renum = sorted.map((l, i) => ({ ...l, z_index: i + 1 }));
        return { ...p, layers: renum };
      }),
    }));
  },

  addPage: () => {
    get().pushHistory();
    set((s) => {
      if (!s.flyer) return s;
      const newPage: FlyerPage = {
        id: uid(),
        flyer_id: s.flyer.id,
        index: s.pages.length,
        name: `Page ${s.pages.length + 1}`,
        background: { color: "#ffffff" },
        layers: [],
      };
      return { pages: [...s.pages, newPage], currentPageId: newPage.id };
    });
  },

  deletePage: (id) => {
    get().pushHistory();
    set((s) => {
      if (s.pages.length <= 1) return s;
      const remaining = s.pages.filter((p) => p.id !== id).map((p, i) => ({ ...p, index: i }));
      return {
        pages: remaining,
        currentPageId: s.currentPageId === id ? remaining[0]?.id ?? null : s.currentPageId,
      };
    });
  },

  renamePage: (id, name) =>
    set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, name } : p)) })),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1];
      return {
        history: s.history.slice(0, -1),
        future: [cloneSnapshot(s.pages), ...s.future],
        pages: prev.pages,
        selectedLayerIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return {
        history: [...s.history, cloneSnapshot(s.pages)],
        future: rest,
        pages: next.pages,
        selectedLayerIds: [],
      };
    }),
}));
