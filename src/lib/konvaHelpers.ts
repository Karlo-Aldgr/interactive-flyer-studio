import { Layer, LayerType, FlyerPage } from "@/types/flyer";

export const uid = () =>
  (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function defaultLayer(type: LayerType, pageId: string, zIndex: number): Layer {
  const base: Layer = {
    id: uid(),
    page_id: pageId,
    type,
    position: { x: 100, y: 100 },
    size: { width: 200, height: 80 },
    rotation: 0,
    z_index: zIndex,
    style: {},
    content: {},
    action: null,
  };
  switch (type) {
    case "text":
      return {
        ...base,
        size: { width: 320, height: 60 },
        style: { fontFamily: "Plus Jakarta Sans", fontSize: 32, fontWeight: 700, color: "#0f172a", align: "left" },
        content: { text: "Your text here" },
      };
    case "image":
      return { ...base, size: { width: 280, height: 200 }, content: { src: "" } };
    case "icon":
      return { ...base, size: { width: 80, height: 80 }, style: { color: "#7c3aed" }, content: { iconName: "Star" } };
    case "shape":
      return {
        ...base,
        size: { width: 180, height: 180 },
        style: { fill: "#8b5cf6", cornerRadius: 16, opacity: 1 },
        content: { shape: "rect" },
      };
    case "button":
      return {
        ...base,
        size: { width: 220, height: 56 },
        style: { fill: "#7c3aed", color: "#ffffff", cornerRadius: 999, fontSize: 16, fontWeight: 600, align: "center" },
        content: { label: "Click me" },
      };
    case "hotspot":
      return {
        ...base,
        size: { width: 200, height: 120 },
        style: { opacity: 1 },
        content: { hotspotShape: "rect" },
      };
  }
}

export function emptyPage(flyerId: string, index: number): FlyerPage {
  return {
    id: uid(),
    flyer_id: flyerId,
    index,
    name: `Page ${index + 1}`,
    background: { color: "#ffffff" },
    layers: [],
  };
}
