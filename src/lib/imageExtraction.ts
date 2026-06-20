export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropResult {
  blob: Blob;
  canvasRect: CanvasRect;
  normalizedBbox: NormalizedBbox;
}

export function intersectRects(a: CanvasRect, b: CanvasRect): CanvasRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load source image"));
    img.src = src;
  });
}

/** Map a canvas selection rect to pixel crop coords within the source image. */
export async function cropImageRegionToBlob(
  imageSrc: string,
  sourceLayerRect: CanvasRect,
  selectionRect: CanvasRect,
): Promise<CropResult> {
  const intersection = intersectRects(sourceLayerRect, selectionRect);
  if (!intersection || intersection.width < 2 || intersection.height < 2) {
    throw new Error("Selection must overlap the source image");
  }

  const normalizedBbox: NormalizedBbox = {
    x: (intersection.x - sourceLayerRect.x) / sourceLayerRect.width,
    y: (intersection.y - sourceLayerRect.y) / sourceLayerRect.height,
    w: intersection.width / sourceLayerRect.width,
    h: intersection.height / sourceLayerRect.height,
  };

  const img = await loadImage(imageSrc);
  const sx = Math.round(normalizedBbox.x * img.naturalWidth);
  const sy = Math.round(normalizedBbox.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(normalizedBbox.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(normalizedBbox.h * img.naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export cutout"))),
      "image/png",
      1,
    );
  });

  return { blob, canvasRect: intersection, normalizedBbox };
}
