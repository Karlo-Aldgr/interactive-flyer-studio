import type { LayerContent, LayerStyle } from "@/types/flyer";

export type ShapeVariant =
  | "rect"
  | "square"
  | "circle"
  | "triangle"
  | "octagon"
  | "line"
  | "dashed-line"
  | "divider";

export interface ShapePreset {
  id: ShapeVariant;
  label: string;
  section: "shapes" | "lines";
  content: Partial<LayerContent>;
  style?: Partial<LayerStyle>;
  size?: { width: number; height: number };
}

export const SHAPE_PRESETS: ShapePreset[] = [
  { id: "rect", label: "Rectangle", section: "shapes", content: { shape: "rect" }, style: { cornerRadius: 16 } },
  { id: "square", label: "Square", section: "shapes", content: { shape: "square" }, size: { width: 160, height: 160 } },
  { id: "circle", label: "Circle", section: "shapes", content: { shape: "circle" }, size: { width: 160, height: 160 } },
  { id: "triangle", label: "Triangle", section: "shapes", content: { shape: "triangle" }, size: { width: 160, height: 160 } },
  { id: "octagon", label: "Octagon", section: "shapes", content: { shape: "octagon" }, size: { width: 160, height: 160 } },
  { id: "line", label: "Straight line", section: "lines", content: { shape: "line" }, size: { width: 200, height: 20 }, style: { strokeWidth: 4 } },
  { id: "dashed-line", label: "Dashed line", section: "lines", content: { shape: "line", lineStyle: "dashed" }, size: { width: 200, height: 20 }, style: { strokeWidth: 4 } },
  { id: "divider", label: "Divider", section: "lines", content: { shape: "divider" }, size: { width: 280, height: 4 }, style: { fill: "#cbd5e1", strokeWidth: 0 } },
];

export type ButtonPresetId = "primary" | "secondary" | "rounded" | "outline" | "cta";

export interface ButtonPreset {
  id: ButtonPresetId;
  label: string;
  contentLabel: string;
  style: Partial<LayerStyle>;
}

export const BUTTON_PRESETS: ButtonPreset[] = [
  { id: "primary", label: "Primary", contentLabel: "Get started", style: { fill: "#7c3aed", color: "#ffffff", cornerRadius: 999, fontSize: 16, fontWeight: 600 } },
  { id: "secondary", label: "Secondary", contentLabel: "Learn more", style: { fill: "#f1f5f9", color: "#0f172a", cornerRadius: 999, fontSize: 16, fontWeight: 500 } },
  { id: "rounded", label: "Rounded", contentLabel: "Click me", style: { fill: "#7c3aed", color: "#ffffff", cornerRadius: 12, fontSize: 16, fontWeight: 600 } },
  { id: "outline", label: "Outline", contentLabel: "Contact us", style: { fill: "transparent", color: "#7c3aed", stroke: "#7c3aed", strokeWidth: 2, cornerRadius: 999, fontSize: 16, fontWeight: 600 } },
  { id: "cta", label: "CTA", contentLabel: "Buy now", style: { fill: "#ea580c", color: "#ffffff", cornerRadius: 8, fontSize: 16, fontWeight: 700 } },
];
