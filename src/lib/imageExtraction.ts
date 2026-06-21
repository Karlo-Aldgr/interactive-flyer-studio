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

export interface SubjectCutoutInput {
  bbox: { x: number; y: number; width: number; height: number };
  polygon: Array<{ x: number; y: number }>;
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

/** Extract a subject cutout using a polygon mask (transparent background outside the shape). */
export async function extractSubjectCutoutToBlob(
  imageSrc: string,
  sourceLayerRect: CanvasRect,
  subject: SubjectCutoutInput,
): Promise<CropResult> {
  const { polygon } = subject;
  if (polygon.length < 3) {
    const rect = {
      x: sourceLayerRect.x + subject.bbox.x * sourceLayerRect.width,
      y: sourceLayerRect.y + subject.bbox.y * sourceLayerRect.height,
      width: subject.bbox.width * sourceLayerRect.width,
      height: subject.bbox.height * sourceLayerRect.height,
    };
    return cropImageRegionToBlob(imageSrc, sourceLayerRect, rect);
  }

  const img = await loadImage(imageSrc);
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  const pixelPoly = polygon.map((p) => ({
    x: p.x * imgW,
    y: p.y * imgH,
  }));

  let minX = imgW;
  let minY = imgH;
  let maxX = 0;
  let maxY = 0;
  for (const p of pixelPoly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(imgW, Math.ceil(maxX));
  maxY = Math.min(imgH, Math.ceil(maxY));
  const sw = Math.max(1, maxX - minX);
  const sh = Math.max(1, maxY - minY);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.beginPath();
  for (let i = 0; i < pixelPoly.length; i++) {
    const px = pixelPoly[i].x - minX;
    const py = pixelPoly[i].y - minY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(img, minX, minY, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export cutout"))),
      "image/png",
      1,
    );
  });

  const canvasRect: CanvasRect = {
    x: sourceLayerRect.x + (minX / imgW) * sourceLayerRect.width,
    y: sourceLayerRect.y + (minY / imgH) * sourceLayerRect.height,
    width: (sw / imgW) * sourceLayerRect.width,
    height: (sh / imgH) * sourceLayerRect.height,
  };

  const normalizedBbox: NormalizedBbox = {
    x: (canvasRect.x - sourceLayerRect.x) / sourceLayerRect.width,
    y: (canvasRect.y - sourceLayerRect.y) / sourceLayerRect.height,
    w: canvasRect.width / sourceLayerRect.width,
    h: canvasRect.height / sourceLayerRect.height,
  };

  return { blob, canvasRect, normalizedBbox };
}
