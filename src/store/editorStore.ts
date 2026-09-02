import { create } from "zustand";
import { Flyer, FlyerPage, FlyerSettings, Layer, LayerAction, LayerContent, LayerStyle, PageIntro } from "@/types/flyer";
import { defaultLayer, emptyPage, uid } from "@/lib/konvaHelpers";
import { ensureUuid } from "@/lib/safeBrowser";
import type { SubjectDetection, NormalizedPoint } from "@/lib/subjectDetect";
import { BUTTON_PRESETS, SHAPE_PRESETS, type ButtonPresetId, type ShapeVariant } from "@/lib/editorToolPresets";
import { buildBizadPage, BIZAD_PAGE_WIDTH } from "@/lib/bizadPage";
import { centerBizadLayerPatches } from "@/lib/bizadLayoutUtils";
import { bizadTileActionPatches } from "@/lib/bizadTileActions";

import { type WebsiteDevice } from "@/lib/websitePage";
import { buildWebsitePageWithTemplate, type WebsiteTemplateId } from "@/lib/websiteTemplates";
import type { WebsiteProfile } from "@/lib/websiteProfile";

import type { BizadRecord } from "@/lib/bizad";

const DEFAULT_FLYER_SETTINGS: FlyerSettings = {
  width: 1080,
  height: 1920,
  background: "#ffffff",
};

function parseFlyerSettings(raw: unknown): FlyerSettings {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore malformed JSON */
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  const width = Number(obj.width);
  const height = Number(obj.height);
  return {
    ...DEFAULT_FLYER_SETTINGS,
    ...(obj as Partial<FlyerSettings>),
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_FLYER_SETTINGS.width,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_FLYER_SETTINGS.height,
    background:
      typeof obj.background === "string" ? obj.background : DEFAULT_FLYER_SETTINGS.background,
  };
}

function normalizeFlyer(flyer: Flyer): Flyer {
  return {
    ...flyer,
    settings: parseFlyerSettings(flyer.settings),
  };
}

export type DrawMode = null | "hotspot" | "hotspot-ellipse" | "crop" | "extract-rect" | "extract-auto";

interface Snapshot {
  pages: FlyerPage[];
}

export type ResizeMode = "resize" | "scale" | "crop" | "fit";
export type DeviceFrame = "desktop" | "tablet" | "mobile";

interface EditorState {
  flyer: Flyer | null;
  pages: FlyerPage[];
  selectedPageId: string | null;
  selectedLayerId: string | null;
  /** Full multi-selection. Always contains selectedLayerId as its first entry when non-empty. */
  selectedLayerIds: string[];
  zoom: number;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  drawMode: DrawMode;
  extractSourceLayerId: string | null;
  subjectDetections: SubjectDetection[];
  showHitboxes: boolean;
  deviceFrame: DeviceFrame;
  pendingCrop: { width: number; height: number } | null;
  // konva stage ref (set by Canvas) — used to render social thumbnails
  stageRef: any | null;
  setStageRef: (s: any | null) => void;
  // Live (uncommitted) action draft for the selected layer — used to preview
  // air messages on the canvas while the user is editing the action panel.
  previewAction: { layerId: string; action: LayerAction | null } | null;
  setPreviewAction: (p: { layerId: string; action: LayerAction | null } | null) => void;
  // hydrate
  hydrate: (flyer: Flyer, pages: FlyerPage[]) => void;
  setFlyer: (patch: Partial<Flyer>) => void;
  setZoom: (z: number) => void;
  selectPage: (id: string) => void;
  selectLayer: (id: string | null) => void;
  selectLayers: (ids: string[]) => void;
  toggleLayerSelection: (id: string) => void;
  clearSelection: () => void;
  selectAllLayers: () => void;
  applyLayerPatches: (patches: Record<string, Partial<Layer>>) => void;
  updateLayersStyle: (ids: string[], patch: Partial<LayerStyle>) => void;
  moveLayersBy: (ids: string[], dx: number, dy: number) => void;
  deleteLayers: (ids: string[]) => void;
  duplicateLayers: (ids: string[]) => void;
  /** Clone a button layer (same style), clear its link, offset position. Returns new layer id. */
  copyButtonLayer: (id: string) => string | null;
  orderLayersBulk: (ids: string[], direction: "front" | "forward" | "backward" | "back") => void;
  alignLayers: (ids: string[], mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void;
  distributeLayers: (ids: string[], axis: "h" | "v") => void;
  setDrawMode: (mode: DrawMode) => void;
  startObjectExtract: (sourceLayerId: string) => void;
  startAutoSubjectExtract: (sourceLayerId: string, detections: SubjectDetection[]) => void;
  markSubjectExtracted: (detectionId: string) => void;
  dismissSubjectDetection: (detectionId: string) => void;
  updateSubjectPolygon: (detectionId: string, polygon: NormalizedPoint[]) => void;
  cancelObjectExtract: () => void;
  toggleHitboxes: () => void;
  setDeviceFrame: (f: DeviceFrame) => void;
  startCrop: (size: { width: number; height: number }) => void;
  cancelCrop: () => void;
  // canvas size
  setCanvasSize: (w: number, h: number, mode: ResizeMode) => void;
  cropCanvas: (rect: { x: number; y: number; width: number; height: number }) => void;
  // pages
  addPage: () => void;
  addLandingPage: (width?: number, height?: number) => void;
  addScannedMenuPage: (args: { imageUrl: string; imgWidth: number; imgHeight: number; items: Array<{ id?: string; name: string; price?: number; description?: string; category?: string; color?: string; bbox: { x: number; y: number; w: number; h: number } }>; }) => string;
  addBizadPage: (bizad: BizadRecord) => string;
  replaceBizadPage: (bizad: BizadRecord) => string;
  setBizadPageHidden: (hidden: boolean) => void;
  /** Centers a page's layers horizontally; returns how many layers moved. */
  centerPageLayout: (pageId: string) => number;
  repairBizadLinks: (pageId: string, bizad: BizadRecord) => number;

  addWebsitePage: (profile: WebsiteProfile, templateId?: WebsiteTemplateId) => string;
  setWebsiteDevice: (device: WebsiteDevice) => void;
  setPageSize: (id: string, w: number, h: number, mode: ResizeMode) => void;


  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  duplicatePage: (id: string) => void;
  reorderPages: (orderedIds: string[]) => void;
  setPageBackground: (id: string, color: string) => void;
  setPageBackgroundImage: (id: string, image: string | null) => void;
  setPageLink: (id: string, linkPageId: string | null) => void;
  setPageIntro: (id: string, intro: PageIntro | null) => void;
  applyIntroToAllPages: (intro: PageIntro | null) => void;
  introReplayKey: number;
  replayIntro: () => void;
  // layers
  addLayer: (
    type: Layer["type"],
    options?: { content?: Partial<LayerContent>; style?: Partial<LayerStyle>; size?: { width: number; height: number } }
  ) => void;
  addShapeLayer: (variant: ShapeVariant) => void;
  addButtonLayer: (presetId: ButtonPresetId) => void;
  addImageLayer: (src: string, w: number, h: number) => void;
  addVideoLayer: (src: string, w?: number, h?: number) => void;
  addHotspotLayer: (rect: { x: number; y: number; width: number; height: number }, shape?: "rect" | "ellipse") => void;
  addExtractedLayer: (args: {
    src: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    sourceLayerId: string;
    extractionBbox: { x: number; y: number; w: number; h: number };
    subjectLabel?: string;
    stayInAutoMode?: boolean;
  }) => void;
  addAirBubbleLayer: (action: LayerAction, size?: { width: number; height: number }) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  updateLayerStyle: (id: string, patch: Partial<LayerStyle>) => void;
  updateLayerContent: (id: string, patch: Partial<LayerContent>) => void;
  setLayerAction: (id: string, action: LayerAction | null) => void;
  setLayerIntro: (id: string, intro: PageIntro | null) => void;
  deleteLayer: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  // history
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const HISTORY_LIMIT = 50;

const snap = (pages: FlyerPage[]): Snapshot => ({
  pages: JSON.parse(JSON.stringify(pages)),
});

const orderLayersByZ = (layers: Layer[]) =>
  [...layers].sort((a, b) => (a.z_index === b.z_index ? layers.indexOf(a) - layers.indexOf(b) : a.z_index - b.z_index));

const resequenceLayers = (layers: Layer[]) => layers.map((layer, z_index) => ({ ...layer, z_index }));

export const useEditorStore = create<EditorState>((set, get) => ({
  flyer: null,
  pages: [],
  selectedPageId: null,
  selectedLayerId: null,
  selectedLayerIds: [],
  zoom: 0.6,
  past: [],
  future: [],
  dirty: false,
  drawMode: null,
  extractSourceLayerId: null,
  subjectDetections: [],
  showHitboxes: false,
  deviceFrame: "desktop",
  pendingCrop: null,
  stageRef: null,
  setStageRef: (s) => set({ stageRef: s }),
  previewAction: null,
  setPreviewAction: (p) => set({ previewAction: p }),
  introReplayKey: 0,
  replayIntro: () => set((s) => ({ introReplayKey: s.introReplayKey + 1 })),

  hydrate: (flyer, pages) =>
    set({
      flyer: normalizeFlyer(flyer),
      pages,
      selectedPageId: pages[0]?.id ?? null,
      selectedLayerId: null,
      selectedLayerIds: [],
      past: [],
      future: [],
      dirty: false,
    }),

  setFlyer: (patch) =>
    set((s) => {
      if (!s.flyer) return s;
      const next = { ...s.flyer, ...patch };
      if ("settings" in patch) {
        next.settings = parseFlyerSettings(patch.settings ?? s.flyer.settings);
      }
      return { flyer: next, dirty: true };
    }),

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(2, z)) }),

  selectPage: (id) => set({ selectedPageId: id, selectedLayerId: null, selectedLayerIds: [] }),
  selectLayer: (id) => set({ selectedLayerId: id, selectedLayerIds: id ? [id] : [] }),

  selectLayers: (ids) => set({ selectedLayerIds: ids, selectedLayerId: ids[0] ?? null }),

  toggleLayerSelection: (id) => {
    const s = get();
    const has = s.selectedLayerIds.includes(id);
    const next = has ? s.selectedLayerIds.filter((x) => x !== id) : [...s.selectedLayerIds, id];
    set({ selectedLayerIds: next, selectedLayerId: next[0] ?? null });
  },

  clearSelection: () => set({ selectedLayerIds: [], selectedLayerId: null }),

  selectAllLayers: () => {
    const s = get();
    const page = s.pages.find((p) => p.id === s.selectedPageId);
    const ids = page ? page.layers.map((l) => l.id) : [];
    set({ selectedLayerIds: ids, selectedLayerId: ids[0] ?? null });
  },

  /** Apply a patch per layer id in one history entry (used for group drag/transform). */
  applyLayerPatches: (patches) => {
    const s = get();
    const ids = Object.keys(patches);
    if (!ids.length) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (patches[l.id] ? { ...l, ...patches[l.id] } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  updateLayersStyle: (ids, patch) => {
    const s = get();
    if (!ids.length) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (ids.includes(l.id) ? { ...l, style: { ...l.style, ...patch } } : l)),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  moveLayersBy: (ids, dx, dy) => {
    const s = get();
    if (!ids.length || (dx === 0 && dy === 0)) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) =>
          ids.includes(l.id)
            ? { ...l, position: { x: l.position.x + dx, y: l.position.y + dy } }
            : l
        ),
      })),
      past,
      future: [],
      dirty: true,
    });
  },

  deleteLayers: (ids) => {
    const s = get();
    if (!ids.length) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({ ...p, layers: p.layers.filter((l) => !ids.includes(l.id)) })),
      selectedLayerId: null,
      selectedLayerIds: [],
      past,
      future: [],
      dirty: true,
    });
  },

  duplicateLayers: (ids) => {
    const s = get();
    if (!ids.length) return;
    const page = s.pages.find((p) => p.id === s.selectedPageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const source = page.layers.filter((l) => ids.includes(l.id));
    let z = page.layers.reduce((m, l) => Math.max(m, l.z_index), 0);
    const clones: Layer[] = source.map((l) => ({
      ...JSON.parse(JSON.stringify(l)),
      id: uid(),
      z_index: ++z,
      position: { x: l.position.x + 16, y: l.position.y + 16 },
      action: l.action ? { ...JSON.parse(JSON.stringify(l.action)), id: ensureUuid(undefined) } : l.action,
    }));
    set({
      pages: s.pages.map((p) => (p.id === page.id ? { ...p, layers: [...p.layers, ...clones] } : p)),
      selectedLayerIds: clones.map((c) => c.id),
      selectedLayerId: clones[0]?.id ?? null,
      past,
      future: [],
      dirty: true,
    });
  },

  copyButtonLayer: (id) => {
    const s = get();
    const page = s.pages.find((p) => p.id === s.selectedPageId);
    if (!page) return null;
    const layer = page.layers.find((l) => l.id === id);
    if (!layer || layer.type !== "button") return null;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const z = page.layers.reduce((m, l) => Math.max(m, l.z_index), 0) + 1;
    const clone: Layer = {
      ...JSON.parse(JSON.stringify(layer)),
      id: uid(),
      z_index: z,
      position: { x: layer.position.x + 16, y: layer.position.y + 16 },
      action: null,
    };
    set({
      pages: s.pages.map((p) => (p.id === page.id ? { ...p, layers: [...p.layers, clone] } : p)),
      selectedLayerIds: [clone.id],
      selectedLayerId: clone.id,
      past,
      future: [],
      dirty: true,
    });
    return clone.id;
  },

  orderLayersBulk: (ids, direction) => {
    const s = get();
    if (!ids.length) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => {
        if (!p.layers.some((l) => ids.includes(l.id))) return p;
        let sorted = orderLayersByZ(p.layers);
        if (direction === "front") {
          const moving = sorted.filter((l) => ids.includes(l.id));
          sorted = [...sorted.filter((l) => !ids.includes(l.id)), ...moving];
        } else if (direction === "back") {
          const moving = sorted.filter((l) => ids.includes(l.id));
          sorted = [...moving, ...sorted.filter((l) => !ids.includes(l.id))];
        } else if (direction === "forward") {
          for (let i = sorted.length - 2; i >= 0; i--) {
            if (ids.includes(sorted[i].id) && !ids.includes(sorted[i + 1].id)) {
              [sorted[i], sorted[i + 1]] = [sorted[i + 1], sorted[i]];
            }
          }
        } else {
          for (let i = 1; i < sorted.length; i++) {
            if (ids.includes(sorted[i].id) && !ids.includes(sorted[i - 1].id)) {
              [sorted[i], sorted[i - 1]] = [sorted[i - 1], sorted[i]];
            }
          }
        }
        return { ...p, layers: resequenceLayers(sorted) };
      }),
      past,
      future: [],
      dirty: true,
    });
  },

  alignLayers: (ids, mode) => {
    const s = get();
    if (ids.length < 2) return;
    const page = s.pages.find((p) => p.id === s.selectedPageId);
    if (!page) return;
    const target = page.layers.filter((l) => ids.includes(l.id));
    if (target.length < 2) return;
    const minX = Math.min(...target.map((l) => l.position.x));
    const maxX = Math.max(...target.map((l) => l.position.x + l.size.width));
    const minY = Math.min(...target.map((l) => l.position.y));
    const maxY = Math.max(...target.map((l) => l.position.y + l.size.height));
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) =>
        p.id !== page.id
          ? p
          : {
              ...p,
              layers: p.layers.map((l) => {
                if (!ids.includes(l.id)) return l;
                const pos = { ...l.position };
                if (mode === "left") pos.x = minX;
                if (mode === "right") pos.x = maxX - l.size.width;
                if (mode === "hcenter") pos.x = (minX + maxX) / 2 - l.size.width / 2;
                if (mode === "top") pos.y = minY;
                if (mode === "bottom") pos.y = maxY - l.size.height;
                if (mode === "vcenter") pos.y = (minY + maxY) / 2 - l.size.height / 2;
                return { ...l, position: pos };
              }),
            }
      ),
      past,
      future: [],
      dirty: true,
    });
  },

  distributeLayers: (ids, axis) => {
    const s = get();
    if (ids.length < 3) return;
    const page = s.pages.find((p) => p.id === s.selectedPageId);
    if (!page) return;
    const target = page.layers
      .filter((l) => ids.includes(l.id))
      .sort((a, b) => (axis === "h" ? a.position.x - b.position.x : a.position.y - b.position.y));
    if (target.length < 3) return;
    const first = target[0];
    const last = target[target.length - 1];
    const startEdge = axis === "h" ? first.position.x + first.size.width : first.position.y + first.size.height;
    const endEdge = axis === "h" ? last.position.x : last.position.y;
    const inner = target.slice(1, -1);
    const totalInner = inner.reduce((sum, l) => sum + (axis === "h" ? l.size.width : l.size.height), 0);
    const gap = (endEdge - startEdge - totalInner) / (inner.length + 1);
    const positions = new Map<string, number>();
    let cursor = startEdge + gap;
    for (const l of inner) {
      positions.set(l.id, cursor);
      cursor += (axis === "h" ? l.size.width : l.size.height) + gap;
    }
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) =>
        p.id !== page.id
          ? p
          : {
              ...p,
              layers: p.layers.map((l) => {
                const v = positions.get(l.id);
                if (v === undefined) return l;
                return {
                  ...l,
                  position: axis === "h" ? { ...l.position, x: v } : { ...l.position, y: v },
                };
              }),
            }
      ),
      past,
      future: [],
      dirty: true,
    });
  },

  setDrawMode: (mode) => {
    const keepExtract = mode === "extract-rect" || mode === "extract-auto";
    set({
      drawMode: mode,
      extractSourceLayerId: keepExtract ? get().extractSourceLayerId : null,
      subjectDetections: mode === "extract-auto" ? get().subjectDetections : [],
    });
  },
  startObjectExtract: (sourceLayerId) =>
    set({
      extractSourceLayerId: sourceLayerId,
      subjectDetections: [],
      drawMode: "extract-rect",
      selectedLayerId: null,
      selectedLayerIds: [],
      previewAction: null,
    }),
  startAutoSubjectExtract: (sourceLayerId, detections) =>
    set({
      extractSourceLayerId: sourceLayerId,
      subjectDetections: detections,
      drawMode: "extract-auto",
      selectedLayerId: null,
      selectedLayerIds: [],
      previewAction: null,
    }),
  markSubjectExtracted: (detectionId) =>
    set((s) => ({
      subjectDetections: s.subjectDetections.map((d) =>
        d.id === detectionId ? { ...d, extracted: true } : d
      ),
    })),
  dismissSubjectDetection: (detectionId) =>
    set((s) => {
      const next = s.subjectDetections.map((d) =>
        d.id === detectionId ? { ...d, dismissed: true } : d
      );
      const active = next.filter((d) => !d.dismissed && !d.extracted);
      if (active.length === 0) {
        return { subjectDetections: [], extractSourceLayerId: null, drawMode: null };
      }
      return { subjectDetections: next };
    }),
  updateSubjectPolygon: (detectionId, polygon) =>
    set((s) => ({
      subjectDetections: s.subjectDetections.map((d) =>
        d.id === detectionId ? { ...d, polygon } : d
      ),
    })),
  cancelObjectExtract: () =>
    set({ extractSourceLayerId: null, subjectDetections: [], drawMode: null }),
  toggleHitboxes: () => set((s) => ({ showHitboxes: !s.showHitboxes })),
  setDeviceFrame: (f) => set({ deviceFrame: f }),
  startCrop: (size) => set({ pendingCrop: size, drawMode: "crop", selectedLayerId: null, selectedLayerIds: [] }),
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
      // Pages that carry their own canvas size (digital business card, landing,
      // scanned menu) are sized independently of the flyer — leave them alone.
      newPages = s.pages.map((p) =>
        p.background?.size
          ? p
          : {
              ...p,
              layers: p.layers.map((l) => ({
                ...l,
                position: { x: l.position.x * sx, y: l.position.y * sy },
                size: { width: l.size.width * sx, height: l.size.height * sy },
              })),
            },
      );
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

    const cropLayers = (layers: Layer[]) =>
      layers
        .map((l) => ({
          ...l,
          position: { x: l.position.x - rect.x, y: l.position.y - rect.y },
        }))
        .filter((l) => {
          const right = l.position.x + l.size.width;
          const bottom = l.position.y + l.size.height;
          return right > 0 && bottom > 0 && l.position.x < rect.width && l.position.y < rect.height;
        });

    // A page with its own canvas size (digital business card, landing, menu)
    // crops independently — the flyer size and the other pages stay untouched.
    const active = s.pages.find((p) => p.id === s.selectedPageId);
    if (active?.background?.size) {
      set({
        pages: s.pages.map((p) =>
          p.id === active.id
            ? {
                ...p,
                background: { ...p.background, size: { width: rect.width, height: rect.height } },
                layers: cropLayers(p.layers),
              }
            : p,
        ),
        pendingCrop: null,
        drawMode: null,
        past,
        future: [],
        dirty: true,
      });
      return;
    }

    const newPages = s.pages.map((p) => p.background?.size ? p : ({
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

  addLandingPage: (width = 1200, height = 630) => {
    const s = get();
    if (!s.flyer) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const base = emptyPage(s.flyer.id, s.pages.length);
    const newPage: FlyerPage = {
      ...base,
      name: "Landing",
      background: { ...base.background, size: { width, height } },
    };
    set({ pages: [...s.pages, newPage], selectedPageId: newPage.id, past, future: [], dirty: true });
  },

  addScannedMenuPage: ({ imageUrl, imgWidth, imgHeight, items }) => {
    const s = get();
    if (!s.flyer) return "";
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    // Fit the page to flyer width, preserve aspect ratio
    const pageW = s.flyer.settings.width;
    const pageH = Math.round(pageW * (imgHeight / Math.max(1, imgWidth)));
    const base = emptyPage(s.flyer.id, s.pages.length);
    const pageId = base.id;
    const imgLayer: Layer = {
      ...defaultLayer("image", pageId, 0),
      position: { x: 0, y: 0 },
      size: { width: pageW, height: pageH },
      content: { src: imageUrl },
      style: {},
    };
    const hotspotLayers: Layer[] = items
      .filter((it) => it.bbox && it.bbox.w > 0 && it.bbox.h > 0)
      .map((it, idx) => {
        const b = it.bbox;
        const hl: Layer = {
          ...defaultLayer("hotspot", pageId, idx + 1),
          position: { x: b.x * pageW, y: b.y * pageH },
          size: { width: Math.max(40, b.w * pageW), height: Math.max(40, b.h * pageH) },
          content: { hotspotShape: "rect" },
          action: {
            id: uid(),
            type: "menu_add_item" as any,
            payload: {
              menuItem: {
                id: it.id || uid(),
                name: it.name,
                price: it.price ?? 0,
                description: it.description,
                category: (it.category as any) || "other",
                color: it.color,
              },
            },
          },
        };
        return hl;
      });
    const newPage: FlyerPage = {
      ...base,
      name: `Menu page ${s.pages.length + 1}`,
      background: { ...base.background, size: { width: pageW, height: pageH } },
      layers: [imgLayer, ...hotspotLayers],
    };
    set({
      pages: [...s.pages, newPage],
      selectedPageId: newPage.id,
      past,
      future: [],
      dirty: true,
      showHitboxes: true,
    });
    return pageId;
  },

  setPageSize: (id, w, h, mode) => {
    const s = get();
    const page = s.pages.find((p) => p.id === id);
    if (!page || !s.flyer) return;
    const oldW = page.background?.size?.width ?? s.flyer.settings.width;
    const oldH = page.background?.size?.height ?? s.flyer.settings.height;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);

    let newLayers = page.layers;
    if (mode === "scale") {
      const sx = w / oldW;
      const sy = h / oldH;
      newLayers = page.layers.map((l) => ({
        ...l,
        position: { x: l.position.x * sx, y: l.position.y * sy },
        size: { width: l.size.width * sx, height: l.size.height * sy },
      }));
    } else if (mode === "crop") {
      newLayers = page.layers.filter((l) => l.position.x < w && l.position.y < h);
    }

    set({
      pages: s.pages.map((p) =>
        p.id === id
          ? { ...p, layers: newLayers, background: { ...p.background, size: { width: w, height: h } } }
          : p
      ),
      past,
      future: [],
      dirty: true,
    });
  },

  addBizadPage: (bizad) => {
    const s = get();
    if (!s.flyer) return "";
    const existing = s.pages.find((p) => p.background?.bizadPage);
    if (existing) {
      if (bizad.enabled) {
        return get().replaceBizadPage(bizad);
      }
      const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
      set({
        pages: s.pages.map((p) =>
          p.id === existing.id
            ? { ...p, background: { ...p.background, bizadHidden: true } }
            : p
        ),
        selectedPageId: existing.id,
        past,
        future: [],
        dirty: true,
      });
      return existing.id;
    }
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const page = buildBizadPage(s.flyer.id, s.pages.length, bizad);
    set({
      pages: [...s.pages, page],
      selectedPageId: page.id,
      selectedLayerId: null,
      selectedLayerIds: [],
      past,
      future: [],
      dirty: true,
    });
    return page.id;
  },

  replaceBizadPage: (bizad) => {
    const s = get();
    if (!s.flyer) return "";
    const existing = s.pages.find((p) => p.background?.bizadPage);
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const fresh = buildBizadPage(s.flyer.id, existing?.index ?? s.pages.length, bizad);
    if (existing) {
      set({
        pages: s.pages.map((p) =>
          p.id === existing.id
            ? { ...fresh, id: existing.id, index: existing.index, flyer_id: existing.flyer_id }
            : p,
        ),
        selectedPageId: existing.id,
        selectedLayerId: null,
        selectedLayerIds: [],
        past,
        future: [],
        dirty: true,
      });
      return existing.id;
    }
    set({
      pages: [...s.pages, fresh],
      selectedPageId: fresh.id,
      selectedLayerId: null,
      selectedLayerIds: [],
      past,
      future: [],
      dirty: true,
    });
    return fresh.id;
  },

  setBizadPageHidden: (hidden) => {
    const s = get();
    const existing = s.pages.find((p) => p.background?.bizadPage);
    if (!existing) return;
    if (!!existing.background?.bizadHidden === hidden) return;
    set({
      pages: s.pages.map((p) =>
        p.id === existing.id ? { ...p, background: { ...p.background, bizadHidden: hidden } } : p
      ),
      dirty: true,
    });
  },

  /** Horizontally centers/tidies a page's layers (used for business card pages). */
  centerPageLayout: (pageId) => {
    const s = get();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return 0;
    const width = page.background?.size?.width ?? BIZAD_PAGE_WIDTH;
    const patches = centerBizadLayerPatches(page.layers as any, width);
    const ids = Object.keys(patches);
    if (!ids.length) return 0;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) =>
        p.id !== page.id
          ? p
          : { ...p, layers: p.layers.map((l) => (patches[l.id] ? { ...l, ...patches[l.id] } : l)) },
      ),
      past,
      future: [],
      dirty: true,
    });
    return ids.length;
  },

  /** Re-attaches standard business-card links (call, email, website, save contact…). */
  repairBizadLinks: (pageId, bizad) => {
    const s = get();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return 0;
    const patches = bizadTileActionPatches(page.layers, bizad);
    const ids = Object.keys(patches);
    if (!ids.length) return 0;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) =>
        p.id !== page.id
          ? p
          : { ...p, layers: p.layers.map((l) => (patches[l.id] ? { ...l, action: patches[l.id] } : l)) },
      ),
      past,
      future: [],
      dirty: true,
    });
    return ids.length;
  },




  /** Creates the single long-scrolling Website page (or selects it if it already exists). */
  addWebsitePage: (profile, templateId) => {
    const s = get();
    if (!s.flyer) return "";
    const existing = s.pages.find((p) => p.background?.websitePage);
    if (existing) {
      set({ selectedPageId: existing.id, selectedLayerId: null, selectedLayerIds: [] });
      return existing.id;
    }
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const page = buildWebsitePageWithTemplate(templateId, s.flyer.id, s.pages.length, profile);
    set({
      pages: [...s.pages, page],
      selectedPageId: page.id,
      selectedLayerId: null,
      selectedLayerIds: [],
      zoom: 0.4,
      past,
      future: [],
      dirty: true,
    });
    return page.id;
  },

  /**
   * Switches the Website page between responsive viewport presets.
   * The page is REBUILT with that viewport's responsive layout rules
   * (columns, typography, stacking, container padding) — never scaled.
   */
  setWebsiteDevice: (device) => {
    const s = get();
    const page = s.pages.find((p) => p.background?.websitePage);
    if (!page || !s.flyer) return;
    const current = page.background?.websiteDevice ?? "desktop";
    if (current === device) return;
    const profile = page.background?.websiteProfile as WebsiteProfile | undefined;
    if (!profile) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);

    // Manual edits must survive a viewport switch. Compare the CURRENT layers with a
    // freshly generated layout for the CURRENT device: anything that differs is a user
    // edit, which we re-apply to the rebuilt layout by (type, ordinal) key.
    const keyOf = (counts: Record<string, number>, type: string) => {
      counts[type] = (counts[type] ?? 0) + 1;
      return `${type}#${counts[type]}`;
    };
    const templateId = page.background?.websiteTemplate as WebsiteTemplateId | undefined;
    const baseline = buildWebsitePageWithTemplate(templateId, s.flyer.id, page.index, profile, current);
    const baseCounts: Record<string, number> = {};
    const baseMap = new Map(baseline.layers.map((l) => [keyOf(baseCounts, l.type), l]));
    const curCounts: Record<string, number> = {};
    const overrides = new Map<string, { content?: any; action?: any; style?: any }>();
    for (const l of page.layers) {
      const key = keyOf(curCounts, l.type);
      const b = baseMap.get(key);
      if (!b) continue;
      const o: { content?: any; action?: any; style?: any } = {};
      if (JSON.stringify(b.content ?? {}) !== JSON.stringify(l.content ?? {})) o.content = l.content;
      if (JSON.stringify(b.action ?? null) !== JSON.stringify(l.action ?? null)) o.action = l.action;
      if (JSON.stringify(b.style ?? {}) !== JSON.stringify(l.style ?? {})) o.style = l.style;
      if (Object.keys(o).length) overrides.set(key, o);
    }

    const rebuilt = buildWebsitePageWithTemplate(templateId, s.flyer.id, page.index, profile, device);
    const newCounts: Record<string, number> = {};
    const layers = rebuilt.layers.map((l) => {
      const key = keyOf(newCounts, l.type);
      const o = overrides.get(key);
      return {
        ...l,
        page_id: page.id,
        ...(o?.content ? { content: { ...l.content, ...o.content } } : {}),
        ...(o?.style ? { style: { ...l.style, ...o.style } } : {}),
        ...(o && "action" in o ? { action: o.action } : {}),
      };
    });

    set({
      pages: s.pages.map((p) =>
        p.id === page.id
          ? { ...rebuilt, id: page.id, index: page.index, name: page.name, layers }
          : p
      ),
      selectedLayerId: null,
      selectedLayerIds: [],
      past,
      future: [],
      dirty: true,
    });
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
      selectedLayerIds: [],
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

  setPageBackgroundImage: (id, image) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) =>
        p.id === id ? { ...p, background: { ...p.background, image: image ?? undefined } } : p
      ),
      past,
      future: [],
      dirty: true,
    });
  },

  setPageLink: (id, linkPageId) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) =>
        p.id === id
          ? { ...p, background: { ...p.background, linkPageId: linkPageId || undefined } }
          : p
      ),
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

  addLayer: (type, options) => {
    const s = get();
    const pageId = s.selectedPageId;
    if (!pageId) return;
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const layer = defaultLayer(type, pageId, page.layers.length);
    if (options?.content) layer.content = { ...layer.content, ...options.content };
    if (options?.style) layer.style = { ...layer.style, ...options.style };
    if (options?.size) layer.size = { ...options.size };
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      selectedLayerIds: [layer.id],
      past,
      future: [],
      dirty: true,
    });
  },

  addShapeLayer: (variant: ShapeVariant) => {
    const preset = SHAPE_PRESETS.find((p) => p.id === variant);
    if (!preset) return;
    get().addLayer("shape", {
      content: preset.content,
      style: preset.style,
      size: preset.size,
    });
  },

  addButtonLayer: (presetId: ButtonPresetId) => {
    const preset = BUTTON_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    get().addLayer("button", {
      content: { label: preset.contentLabel },
      style: preset.style,
    });
  },

  addAirBubbleLayer: (action, size) => {
    const s = get();
    const pageId = s.selectedPageId;
    if (!pageId) return;
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const base = defaultLayer("hotspot", pageId, page.layers.length);
    const w = size?.width ?? 600;
    const h = size?.height ?? 120;
    // Stagger position so a fresh bubble layer doesn't sit exactly on top of others
    const offset = (page.layers.length % 6) * 24;
    const layer: Layer = {
      ...base,
      position: { x: base.position.x + offset, y: base.position.y + offset },
      size: { width: w, height: h },
      action,
    };
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      selectedLayerIds: [layer.id],
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
      selectedLayerIds: [layer.id],
      past,
      future: [],
      dirty: true,
    });
  },

  addVideoLayer: (src, w, h) => {
    const s = get();
    const pageId = s.selectedPageId;
    if (!pageId) return;
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const max = 480;
    const ratio = w && h ? w / h : 16 / 9;
    const width = Math.min(max, w || max);
    const height = width / ratio;
    const base = defaultLayer("video", pageId, page.layers.length);
    const layer: Layer = {
      ...base,
      size: { width, height },
      content: { ...base.content, videoUrl: src },
    };
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      selectedLayerIds: [layer.id],
      past,
      future: [],
      dirty: true,
    });
  },

  addHotspotLayer: (rect, shape = "rect") => {
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
      content: { ...base.content, hotspotShape: shape },
    };
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      selectedLayerIds: [layer.id],
      drawMode: null,
      past,
      future: [],
      dirty: true,
    });
  },

  addExtractedLayer: ({ src, position, size, sourceLayerId, extractionBbox, subjectLabel, stayInAutoMode }) => {
    const s = get();
    const pageId = s.selectedPageId;
    if (!pageId) return;
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return;
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    const maxZ = page.layers.reduce((m, l) => Math.max(m, l.z_index), -1);
    const layer: Layer = {
      ...defaultLayer("image", pageId, maxZ + 1),
      position,
      size,
      z_index: maxZ + 1,
      content: {
        src,
        extractedFrom: sourceLayerId,
        extractionBbox,
        subjectLabel,
        label: subjectLabel || "Cutout",
      },
    };
    set({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, layers: [...p.layers, layer] } : p)),
      selectedLayerId: layer.id,
      selectedLayerIds: [layer.id],
      extractSourceLayerId: stayInAutoMode ? sourceLayerId : null,
      subjectDetections: stayInAutoMode ? s.subjectDetections : [],
      drawMode: stayInAutoMode ? "extract-auto" : null,
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
    const next = action ? { ...action, id: ensureUuid(action.id) } : null;
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

  setLayerIntro: (id, intro) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, intro } : l)),
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
      pages: s.pages.map((p) => {
        if (!p.layers.some((l) => l.id === id)) return p;
        const sorted = orderLayersByZ(p.layers);
        const idx = sorted.findIndex((l) => l.id === id);
        if (idx < 0 || idx === sorted.length - 1) return p;
        const reordered = [...sorted];
        [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
        return { ...p, layers: resequenceLayers(reordered) };
      }),
      past,
      future: [],
      dirty: true,
    });
  },

  sendBackward: (id) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => {
        if (!p.layers.some((l) => l.id === id)) return p;
        const sorted = orderLayersByZ(p.layers);
        const idx = sorted.findIndex((l) => l.id === id);
        if (idx <= 0) return p;
        const reordered = [...sorted];
        [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
        return { ...p, layers: resequenceLayers(reordered) };
      }),
      past,
      future: [],
      dirty: true,
    });
  },

  bringToFront: (id) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => {
        if (!p.layers.some((l) => l.id === id)) return p;
        const sorted = orderLayersByZ(p.layers);
        const idx = sorted.findIndex((l) => l.id === id);
        if (idx < 0 || idx === sorted.length - 1) return p;
        const reordered = [...sorted];
        const [item] = reordered.splice(idx, 1);
        reordered.push(item);
        return { ...p, layers: resequenceLayers(reordered) };
      }),
      past,
      future: [],
      dirty: true,
    });
  },

  sendToBack: (id) => {
    const s = get();
    const past = [...s.past, snap(s.pages)].slice(-HISTORY_LIMIT);
    set({
      pages: s.pages.map((p) => {
        if (!p.layers.some((l) => l.id === id)) return p;
        const sorted = orderLayersByZ(p.layers);
        const idx = sorted.findIndex((l) => l.id === id);
        if (idx <= 0) return p;
        const reordered = [...sorted];
        const [item] = reordered.splice(idx, 1);
        reordered.unshift(item);
        return { ...p, layers: resequenceLayers(reordered) };
      }),
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
