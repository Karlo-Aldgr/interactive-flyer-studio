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
  extracted?: boolean;
}

export function bboxToCanvasRect(bbox: SubjectBbox, sourceLayerRect: CanvasRect): CanvasRect {
  return {
    x: sourceLayerRect.x + bbox.x * sourceLayerRect.width,
    y: sourceLayerRect.y + bbox.y * sourceLayerRect.height,
    width: bbox.width * sourceLayerRect.width,
    height: bbox.height * sourceLayerRect.height,
  };
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
