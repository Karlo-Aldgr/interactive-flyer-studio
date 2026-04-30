import { supabase } from "@/integrations/supabase/client";

const TARGET_W = 1200;
const TARGET_H = 630;
const BUCKET = "flyer-thumbnails";

export function thumbnailStoragePath(flyerId: string) {
  return `${flyerId}.jpg`;
}

export function thumbnailPublicUrl(flyerId: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(thumbnailStoragePath(flyerId));
  return data.publicUrl;
}

/**
 * Render a Konva stage to a JPEG dataURL covering the flyer page in native pixels.
 */
export function stageToSocialDataURL(
  stage: any,
  flyerW: number,
  flyerH: number,
  _background: string
): string | null {
  if (!stage) return null;
  const stagePixelRatio = Math.min(2, Math.max(1, TARGET_W / flyerW));
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
  background: string
): Promise<Blob> {
  const img = await loadImage(rawDataUrl);

  const out = document.createElement("canvas");
  out.width = TARGET_W;
  out.height = TARGET_H;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = background || "#ffffff";
  ctx.fillRect(0, 0, TARGET_W, TARGET_H);

  // Fit (contain) the flyer inside 1200x630
  const flyerAspect = flyerW / flyerH;
  const targetAspect = TARGET_W / TARGET_H;
  let dw: number;
  let dh: number;
  if (flyerAspect > targetAspect) {
    dw = TARGET_W;
    dh = TARGET_W / flyerAspect;
  } else {
    dh = TARGET_H;
    dw = TARGET_H * flyerAspect;
  }
  const dx = (TARGET_W - dw) / 2;
  const dy = (TARGET_H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))),
      "image/jpeg",
      0.85
    );
  });
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
): Promise<string | null> {
  if (!stage) return null;
  try {
    const raw = stageToSocialDataURL(stage, flyerW, flyerH, background);
    if (!raw) return null;
    const blob = await composeSocialImage(raw, flyerW, flyerH, background);

    const path = thumbnailStoragePath(flyerId);
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "3600",
      });
    if (uploadErr) {
      console.warn("[thumbnail] upload failed", uploadErr);
      return null;
    }

    const cleanUrl = thumbnailPublicUrl(flyerId);
    // Persist the clean (no-querystring) URL so social crawlers get a stable image URL.
    await supabase.from("flyers").update({ thumbnail_url: cleanUrl }).eq("id", flyerId);

    // Return cache-busted variant for the UI <img> so the user sees the fresh capture.
    return `${cleanUrl}?v=${Date.now()}`;
  } catch (e) {
    console.warn("[thumbnail] generation failed", e);
    return null;
  }
}
