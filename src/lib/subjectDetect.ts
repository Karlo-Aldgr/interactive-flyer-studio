import type { CanvasRect } from "@/lib/imageExtraction";

export type SubjectCategory =
  | "person"
  | "face"
  | "animal"
  | "house"
  | "building"
  | "tree"
  | "plant"
  | "product"
  | "logo"
  | "vehicle"
  | "text"
  | "food"
  | "furniture"
  | "object";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SubjectBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SubjectDetection {
  id: string;
  label: string;
  category: SubjectCategory;
  bbox: SubjectBbox;
  polygon?: NormalizedPoint[];
  extracted?: boolean;
  dismissed?: boolean;
}

export function bboxToCanvasRect(bbox: SubjectBbox, sourceLayerRect: CanvasRect): CanvasRect {
  return {
    x: sourceLayerRect.x + bbox.x * sourceLayerRect.width,
    y: sourceLayerRect.y + bbox.y * sourceLayerRect.height,
    width: bbox.width * sourceLayerRect.width,
    height: bbox.height * sourceLayerRect.height,
  };
}

export function polygonToCanvasPoints(
  polygon: NormalizedPoint[],
  sourceLayerRect: CanvasRect,
): number[] {
  const points: number[] = [];
  for (const p of polygon) {
    points.push(
      sourceLayerRect.x + p.x * sourceLayerRect.width,
      sourceLayerRect.y + p.y * sourceLayerRect.height,
    );
  }
  return points;
}

export function polygonBounds(polygon: NormalizedPoint[]): SubjectBbox | null {
  if (polygon.length < 3) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function bboxToNormalized(bbox: SubjectBbox): { x: number; y: number; w: number; h: number } {
  return { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
}

export const SUBJECT_CATEGORY_LABEL: Record<SubjectCategory, string> = {
  person: "Person",
  face: "Face",
  animal: "Animal",
  house: "House",
  building: "Building",
  tree: "Tree",
  plant: "Plant",
  product: "Product",
  logo: "Logo",
  vehicle: "Vehicle",
  text: "Text",
  food: "Food",
  furniture: "Furniture",
  object: "Object",
};
