import { create } from "zustand";
import { Flyer, FlyerPage, Layer, LayerAction, LayerContent, LayerStyle } from "@/types/flyer";
import { defaultLayer, emptyPage, uid } from "@/lib/konvaHelpers";

interface Snapshot {
  pages: FlyerPage[];
}

interface EditorState {
  flyer: Flyer | null;
  pages: FlyerPage[];
  selectedPageId: string | null;
  selectedLayerId: string | null;
  zoom: number;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  drawMode: null | "hotspot";
  // hydrate
  hydrate: (flyer: Flyer, pages: FlyerPage[]) => void;
  setFlyer: (patch: Partial<Flyer>) => void;
  setZoom: (z: number) => void;
  selectPage: (id: string) => void;
  selectLayer: (id: string | null) => void;
  setDrawMode: (mode: null | "hotspot") => void;
  // pages
  addPage: () => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  setPageBackground: (id: string, color: string) => void;
  // layers
  addLayer: (type: Layer["type"]) => void;
  addImageLayer: (src: string, w: number, h: number) => void;
  addHotspotLayer: (rect: { x: number; y: number; width: number; height: number }) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  updateLayerStyle: (id: string, patch: Partial<LayerStyle>) => void;
  updateLayerContent: (id: string, patch: Partial<LayerContent>) => void;
  setLayerAction: (id: string, action: LayerAction | null) => void;
  deleteLayer: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  // history
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const HISTORY_LIMIT = 50;

const snap = (pages: FlyerPage[]): Snapshot => ({
  pages: JSON.parse(JSON.stringify(pages)),
});

export const useEditorStore = create<EditorState>((set, get) => ({
  flyer: null,
  pages: [],
  selectedPageId: null,
  selectedLayerId: null,
  zoom: 0.6,
  past: [],
  future: [],
  dirty: false,
  drawMode: null,

  hydrate: (flyer, pages) =>
    set({
      flyer,
      pages,
      selectedPageId: pages[0]?.id ?? null,
      selectedLayerId: null,
      past: [],
      future: [],
      dirty: false,
    }),

  setFlyer: (patch) =>
    set((s) => ({ flyer: s.flyer ? { ...s.flyer, ...patch } : s.flyer, dirty: true })),

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(2, z)) }),

  selectPage: (id) => set({ selectedPageId: id, selectedLayerId: null }),
  selectLayer: (id) => set({ selectedLayerId: id }),
  setDrawMode: (mode) => set({ drawMode: mode }),

  addPage: () => {
    const s = get();
    if (!s.flyer) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const newPage = emptyPage(s.flyer.id, s.pages.length);
    set({ pages: [...s.pages, newPage], selectedPageId: newPage.id, past, future: [], dirty: true });
  },

  deletePage: (id) => {
    const s = get();
    if (s.pages.length <= 1) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const filtered = s.pages.filter((p) => p.id !== id).map((p, i) => ({ ...p, index: i }));
    set({
      pages: filtered,
      selectedPageId: filtered[0].id,
      selectedLayerId: null,
      past,
      future: [],
      dirty: true,
    });
  },

  renamePage: (id, name) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({ pages: s.pages.map((p) => (p.id === id ? { ...p, name } : p)), past, future: [], dirty: true });
  },

  setPageBackground: (id, color) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => (p.id === id ? { ...p, background: { ...p.background, color } } : p)),
      past,
      future: [],
      dirty: true,
    });
  },

  addLayer: (type) => {
    const s = get();
    const pageId = s.selectedPageId;
    if (!pageId) return;
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const layer = defaultLayer(type, pageId, page.layers.length);
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      past,
      future: [],
      dirty: true,
    });
  },

  addImageLayer: (src, w, h) => {
    const s = get();
    const pageId = s.selectedPageId;
    if (!pageId) return;
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const max = 400;
    const ratio = w / h;
    const width = w > max ? max : w;
    const height = w > max ? max / ratio : h;
    const layer: Layer = {
      ...defaultLayer("image", pageId, page.layers.length),
      size: { width, height },
      content: { src },
    };
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      past,
      future: [],
      dirty: true,
    });
  },

  addHotspotLayer: (rect) => {
    const s = get();
    const pageId = s.selectedPageId;
    if (!pageId) return;
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const base = defaultLayer("hotspot", pageId, page.layers.length);
    const layer: Layer = {
      ...base,
      position: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height },
    };
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      drawMode: null,
      past,
      future: [],
      dirty: true,
    });
  },


    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  updateLayerStyle: (id, patch) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, style: { ...l.style, ...patch } } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  updateLayerContent: (id, patch) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, content: { ...l.content, ...patch } } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  setLayerAction: (id, action) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const next = action ? { ...action, id: action.id || uid() } : null;
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, action: next } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  deleteLayer: (id) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) })),
      selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
      past,
      future: [],
      dirty: true,
    });
  },

  bringForward: (id) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, z_index: l.z_index + 1 } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  sendBackward: (id) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, z_index: Math.max(0, l.z_index - 1) } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const prev = s.past[s.past.length - 1];
    set({
      pages: prev.pages,
      past: s.past.slice(0, -1),
      future: [snap(s.pages), ...s.future].slice(0, HISTORY_LIMIT),
      dirty: true,
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[0];
    set({
      pages: next.pages,
      past: [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT),
      future: s.future.slice(1),
      dirty: true,
    });
  },

  markSaved: () => set({ dirty: false }),
}));
