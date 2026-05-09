import { supabase } from "@/integrations/supabase/client";

const MAX_DIM = 1200;
const BUCKET = "flyer-thumbnails";

function fitDims(w: number, h: number, max = MAX_DIM) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

export function thumbnailStoragePath(flyerId: string) {
  return `${flyerId}.jpg`;
}

export function thumbnailPublicUrl(ownerId: string, flyerId: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${ownerId}/${thumbnailStoragePath(flyerId)}`);
  return data.publicUrl;
}

function drawContainedImage(img: HTMLImageElement, _background = "#ffffff"): Blob | PromiseLike<Blob> {
  // Preserve the source image's own aspect ratio — no padding.
  const { w, h } = fitDims(img.naturalWidth, img.naturalHeight);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))),
      "image/jpeg",
      0.9
    );
  });
}

/**
 * Render a Konva stage to a JPEG dataURL at the flyer's native aspect ratio
 * (longest side capped at MAX_DIM).
 */
export function stageToSocialDataURL(
  stage: any,
  flyerW: number,
  flyerH: number,
  _background: string
): string | null {
  if (!stage) return null;
  const { w: targetW } = fitDims(flyerW, flyerH);
  const stagePixelRatio = Math.min(2, Math.max(1, targetW / flyerW));
  const scale = stage.scaleX() || 1;
  const dataUrl: string = stage.toDataURL({
    x: 0,
    y: 0,
    width: flyerW * scale,
    height: flyerH * scale,
    pixelRatio: stagePixelRatio / scale,
    mimeType: "image/jpeg",
    quality: 0.85,
  });
  return dataUrl;
}

export async function composeSocialImage(
  rawDataUrl: string,
  flyerW: number,
  flyerH: number,
  _background: string
): Promise<Blob> {
  const img = await loadImage(rawDataUrl);

  // Output the flyer at its own aspect ratio — no letterbox padding.
  const { w, h } = fitDims(flyerW, flyerH);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))),
      "image/jpeg",
      0.85
    );
  });
}

async function uploadThumbnailBlob(blob: Blob, flyerId: string): Promise<string> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    throw new Error("Sign in required to upload the preview image.");
  }

  const path = `${authData.user.id}/${thumbnailStoragePath(flyerId)}`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadErr) {
    console.warn("[thumbnail] upload failed", uploadErr);
    throw new Error("Upload failed: " + uploadErr.message);
  }

  const cleanUrl = thumbnailPublicUrl(authData.user.id, flyerId);
  const { error: dbErr } = await supabase
    .from("flyers")
    .update({ thumbnail_url: cleanUrl })
    .eq("id", flyerId);
  if (dbErr) {
    console.warn("[thumbnail] db update failed", dbErr);
    throw new Error("Saving thumbnail URL failed: " + dbErr.message);
  }

  return `${cleanUrl}?v=${Date.now()}`;
}

export async function uploadManualThumbnail(file: File, flyerId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const blob = await drawContainedImage(img);
    return uploadThumbnailBlob(blob, flyerId);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Render the current first-page Konva stage, upload to Supabase storage,
 * write the CLEAN public URL (no cache-buster) to flyers.thumbnail_url,
 * and return a cache-busted URL for immediate UI display.
 */
export async function generateAndUploadThumbnail(
  stage: any,
  flyerId: string,
  flyerW: number,
  flyerH: number,
  background: string
): Promise<string> {
  if (!stage) {
    throw new Error("Canvas not ready (no stage). Please open the editor and try again.");
  }
  let raw: string | null;
  try {
    raw = stageToSocialDataURL(stage, flyerW, flyerH, background);
  } catch (e: any) {
    // Common cause: a cross-origin image tainted the canvas.
    console.warn("[thumbnail] stage.toDataURL failed", e);
    throw new Error(
      "Canvas could not be exported (an image may be blocking export). " + (e?.message || "")
    );
  }
  if (!raw) throw new Error("Canvas returned an empty image.");

  const blob = await composeSocialImage(raw, flyerW, flyerH, background);
  return uploadThumbnailBlob(blob, flyerId);
}

