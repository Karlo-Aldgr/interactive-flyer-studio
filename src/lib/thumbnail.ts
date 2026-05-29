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

function drawContainedImage(img: HTMLImageElement, background = "#000000"): Blob | PromiseLike<Blob> {
  // Manual share uploads must also be Facebook-safe, so store them as a
  // 1200×630 card instead of preserving a portrait aspect ratio.
  return composeSocialCard(img.src, img.naturalWidth, img.naturalHeight, background);
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
  // Used for the in-app `thumbnail_url` (gallery / dashboard previews).
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

/**
 * Compose a Facebook/WhatsApp-friendly 1200x630 social card. The flyer is
 * rendered "contained" (letterboxed) on a solid background so portrait flyers
 * still trigger Facebook's large-image link preview (which requires the image
 * to be at least 600x315 and roughly 1.91:1).
 */
export async function composeSocialCard(
  rawDataUrl: string,
  flyerW: number,
  flyerH: number,
  background: string
): Promise<Blob> {
  const CARD_W = 1200;
  const CARD_H = 630;
  const img = await loadImage(rawDataUrl);

  const out = document.createElement("canvas");
  out.width = CARD_W;
  out.height = CARD_H;
  const ctx = out.getContext("2d")!;

  // Background fill — use the flyer's own background so letterbox bars blend in.
  ctx.fillStyle = background || "#000000";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Contain-fit the flyer inside the card.
  const srcW = img.naturalWidth || flyerW;
  const srcH = img.naturalHeight || flyerH;
  const scale = Math.min(CARD_W / srcW, CARD_H / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const dx = Math.round((CARD_W - drawW) / 2);
  const dy = Math.round((CARD_H - drawH) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))),
      "image/jpeg",
      0.88
    );
  });
}

async function uploadThumbnailBlob(blob: Blob, flyerId: string): Promise<string> {
  let { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    // Try refreshing once before giving up
    await supabase.auth.refreshSession().catch(() => {});
    ({ data: authData, error: authErr } = await supabase.auth.getUser());
  }
  if (authErr || !authData.user) {
    throw new Error("Your session expired. Please sign in again to upload a preview image.");
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
    const msg = uploadErr.message || "";
    if (/row-level security|rls|unauthor/i.test(msg)) {
      throw new Error("Upload blocked: your session expired or you don't own this flyer. Please sign in again.");
    }
    throw new Error("Upload failed: " + msg);
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

/**
 * Upload a "flyer-only" preview variant to a sibling object in the same bucket
 * (e.g. `${owner}/${flyerId}-flyer.jpg`). Does NOT touch the flyers table — the
 * landing-page image stays as the canonical `thumbnail_url`. The share Worker
 * picks this URL when the share link has no `?page=` parameter (direct flyer link).
 *
 * Output is a 1200x630 social card (flyer letterboxed on its background) so
 * Facebook/Messenger/WhatsApp render the large hero preview instead of the
 * tiny left-side thumbnail card.
 */
export async function uploadFlyerVariantFromDataUrl(
  dataUrl: string,
  flyerId: string,
  flyerW: number,
  flyerH: number,
  background: string = "#000000"
): Promise<string> {
  const blob = await composeSocialCard(dataUrl, flyerW, flyerH, background);
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) throw new Error("Sign in required to upload the preview image.");
  const path = `${authData.user.id}/${flyerId}-flyer.jpg`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
  if (uploadErr) throw new Error("Upload failed: " + uploadErr.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload a per-page landing variant to `${owner}/${flyerId}-${pageId}-flyer.jpg`.
 * The Cloudflare share Worker serves this image when the share URL has
 * `?page=<pageId>`. Does NOT touch the flyers table.
 *
 * Output is a 1200x630 social card (see `uploadFlyerVariantFromDataUrl`).
 */
export async function uploadLandingVariantFromDataUrl(
  dataUrl: string,
  flyerId: string,
  pageId: string,
  flyerW: number,
  flyerH: number,
  background: string = "#000000"
): Promise<string> {
  const blob = await composeSocialCard(dataUrl, flyerW, flyerH, background);
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) throw new Error("Sign in required to upload the preview image.");
  const path = `${authData.user.id}/${flyerId}-${pageId}-flyer.jpg`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
  if (uploadErr) throw new Error("Upload failed: " + uploadErr.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
/**
 * Wait for every Konva.Image node on the stage to have a fully-loaded
 * HTMLImageElement so that `stage.toDataURL()` doesn't capture a blank
 * frame while images are still streaming in. Resolves after each image
 * either loads, errors, or hits a short safety timeout.
 */
export async function waitForStageImages(stage: any, perImageTimeoutMs = 2000): Promise<void> {
  if (!stage || typeof stage.find !== "function") return;
  try {
    const imgNodes: any[] = stage.find("Image") || [];
    await Promise.all(
      imgNodes.map((n: any) => {
        const img = n.image && n.image();
        if (!img) return Promise.resolve();
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener?.("load", done, { once: true });
          img.addEventListener?.("error", done, { once: true });
          setTimeout(done, perImageTimeoutMs);
        });
      })
    );
    stage.batchDraw?.();
    // One extra paint tick so the newly-drawn pixels are committed.
    await new Promise((r) => setTimeout(r, 80));
  } catch (e) {
    console.warn("[waitForStageImages] failed", e);
  }
}

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
  await waitForStageImages(stage);
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

  // Store the canonical `thumbnail_url` as the same 1200×630 social card that
  // Facebook requires. This makes the Worker fallback safe even when a newer
  // per-page/direct variant has not been generated yet.
  const blob = await composeSocialCard(raw, flyerW, flyerH, background);
  return uploadThumbnailBlob(blob, flyerId);
}

