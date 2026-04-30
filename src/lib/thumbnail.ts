import { supabase } from "@/integrations/supabase/client";

const TARGET_W = 1200;
const TARGET_H = 630;

/**
 * Render a Konva stage to a 1200×630 JPEG (social-share friendly),
 * letterboxing the flyer page on its background color.
 */
export function stageToSocialDataURL(
  stage: any,
  flyerW: number,
  flyerH: number,
  background: string
): string | null {
  if (!stage) return null;
  // Konva: get an image of the stage at its native (unscaled) flyer dimensions.
  const stagePixelRatio = Math.min(2, Math.max(1, TARGET_W / flyerW));
  // Snapshot the entire visible stage. We compensate for editor zoom by passing
  // pixelRatio that targets the native flyer width.
  // First, we need source coords in unscaled flyer space → use stage's getClientRect-less approach:
  // toDataURL with x/y/width/height are in stage (post-scale) pixel coordinates.
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

  // Compose onto a 1200x630 canvas with the page background letterboxed.
  const out = document.createElement("canvas");
  out.width = TARGET_W;
  out.height = TARGET_H;
  const ctx = out.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.fillStyle = background || "#ffffff";
  ctx.fillRect(0, 0, TARGET_W, TARGET_H);

  // We have to draw synchronously, but the toDataURL produces an image we must load.
  // Return a promise via a wrapper instead — see composeSocialImage.
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
 * and write the resulting public URL to flyers.thumbnail_url.
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

    const path = `${flyerId}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("flyer-thumbnails")
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "3600",
      });
    if (uploadErr) {
      console.warn("[thumbnail] upload failed", uploadErr);
      return null;
    }

    const { data } = supabase.storage.from("flyer-thumbnails").getPublicUrl(path);
    const cacheBusted = `${data.publicUrl}?v=${Date.now()}`;

    await supabase.from("flyers").update({ thumbnail_url: cacheBusted }).eq("id", flyerId);
    return cacheBusted;
  } catch (e) {
    console.warn("[thumbnail] generation failed", e);
    return null;
  }
}
