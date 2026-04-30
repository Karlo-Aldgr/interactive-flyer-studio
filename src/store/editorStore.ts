import { create } from "zustand";
import { Flyer, FlyerPage, Layer, LayerAction, LayerContent, LayerStyle, PageIntro } from "@/types/flyer";
import { defaultLayer, emptyPage, uid } from "@/lib/konvaHelpers";

interface Snapshot {
  pages: FlyerPage[];
}

export type ResizeMode = "resize" | "scale" | "crop";
export type DeviceFrame = "desktop" | "tablet" | "mobile";

interface EditorState {
  flyer: Flyer | null;
  pages: FlyerPage[];
  selectedPageId: string | null;
  selectedLayerId: string | null;
  zoom: number;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  drawMode: null | "hotspot" | "crop";
  showHitboxes: boolean;
  deviceFrame: DeviceFrame;
  pendingCrop: { width: number; height: number } | null;
  // hydrate
  hydrate: (flyer: Flyer, pages: FlyerPage[]) => void;
  setFlyer: (patch: Partial<Flyer>) => void;
  setZoom: (z: number) => void;
  selectPage: (id: string) => void;
  selectLayer: (id: string | null) => void;
  setDrawMode: (mode: null | "hotspot" | "crop") => void;
  toggleHitboxes: () => void;
  setDeviceFrame: (f: DeviceFrame) => void;
  startCrop: (size: { width: number; height: number }) => void;
  cancelCrop: () => void;
  // canvas size
  setCanvasSize: (w: number, h: number, mode: ResizeMode) => void;
  cropCanvas: (rect: { x: number; y: number; width: number; height: number }) => void;
  // pages
  addPage: () => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  duplicatePage: (id: string) => void;
  reorderPages: (orderedIds: string[]) => void;
  setPageBackground: (id: string, color: string) => void;
  setPageIntro: (id: string, intro: PageIntro | null) => void;
  applyIntroToAllPages: (intro: PageIntro | null) => void;
  introReplayKey: number;
  replayIntro: () => void;
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
  showHitboxes: false,
  deviceFrame: "desktop",
  pendingCrop: null,

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
  toggleHitboxes: () => set((s) => ({ showHitboxes: !s.showHitboxes })),
  setDeviceFrame: (f) => set({ deviceFrame: f }),
  startCrop: (size) => set({ pendingCrop: size, drawMode: "crop", selectedLayerId: null }),
  cancelCrop: () => set({ pendingCrop: null, drawMode: null }),

  setCanvasSize: (w, h, mode) => {
    const s = get();
    if (!s.flyer) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const oldW = s.flyer.settings.width;
    const oldH = s.flyer.settings.height;

    let newPages = s.pages;
    if (mode === "scale") {
      const sx = w / oldW;
      const sy = h / oldH;
      newPages = s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => ({
          ...l,
          position: { x: l.position.x * sx, y: l.position.y * sy },
          size: { width: l.size.width * sx, height: l.size.height * sy },
        })),
      }));
    }

    set({
      flyer: { ...s.flyer, settings: { ...s.flyer.settings, width: w, height: h } },
      pages: newPages,
      past,
      future: [],
      dirty: true,
    });
  },

  cropCanvas: (rect) => {
    const s = get();
    if (!s.flyer) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const newPages = s.pages.map((p) => ({
      ...p,
      layers: p.layers
        .map((l) => ({
          ...l,
          position: { x: l.position.x - rect.x, y: l.position.y - rect.y },
        }))
        .filter((l) => {
          const right = l.position.x + l.size.width;
          const bottom = l.position.y + l.size.height;
          return right > 0 && bottom > 0 && l.position.x < rect.width && l.position.y < rect.height;
        }),
    }));
    set({
      flyer: { ...s.flyer, settings: { ...s.flyer.settings, width: rect.width, height: rect.height } },
      pages: newPages,
      pendingCrop: null,
      drawMode: null,
      past,
      future: [],
      dirty: true,
    });
  },

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

  duplicatePage: (id) => {
    const s = get();
    const orig = s.pages.find((p) => p.id === id);
    if (!orig || !s.flyer) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const newPageId = uid();
    const dup: FlyerPage = {
      ...JSON.parse(JSON.stringify(orig)),
      id: newPageId,
      name: `${orig.name} copy`,
    };
    // give all layers new ids
    dup.layers = dup.layers.map((l) => ({
      ...l,
      id: uid(),
      page_id: newPageId,
      action: l.action ? { ...l.action, id: uid() } : null,
    }));
    const idx = s.pages.findIndex((p) => p.id === id);
    const next = [...s.pages.slice(0, idx + 1), dup, ...s.pages.slice(idx + 1)].map((p, i) => ({ ...p, index: i }));
    set({ pages: next, selectedPageId: dup.id, past, future: [], dirty: true });
  },

  reorderPages: (orderedIds) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const map = new Map(s.pages.map((p) => [p.id, p]));
    const next = orderedIds
      .map((id, i) => {
        const p = map.get(id);
        return p ? { ...p, index: i } : null;
      })
      .filter(Boolean) as FlyerPage[];
    set({ pages: next, past, future: [], dirty: true });
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

  setPageIntro: (id, intro) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => (p.id === id ? { ...p, intro } : p)),
      past,
      future: [],
      dirty: true,
    });
  },

  applyIntroToAllPages: (intro) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({ ...p, intro })),
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

  updateLayer: (id, patch) => {
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
