import type { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { defaultLayer, uid } from "@/lib/konvaHelpers";
import type { BizadRecord } from "@/lib/bizad";
import { BIZAD_DEFAULT_BACKGROUND_COLOR, BIZAD_DEFAULT_BUTTON_COLOR } from "@/lib/bizadDefaults";
import { buildBizadQrImageUrl } from "@/lib/bizadLayoutUtils";
import { BIZAD_PAGE_HEIGHT, BIZAD_PAGE_WIDTH, act, button, text } from "@/lib/bizadTemplates/kit";

export const BIZAD_PAGE_NAME = "Digital business card";
export const VONTASTIC_TEMPLATE_ID = "vontastic_v1";

/** Vontastic-style digital business card editor page (original standard layout). */
export function buildVontasticBizadPage(flyerId: string, index: number, bizad: BizadRecord): FlyerPage {
  const pageId = uid();
  const W = BIZAD_PAGE_WIDTH;
  const btnColor = bizad.button_color || BIZAD_DEFAULT_BUTTON_COLOR;
  const bgColor = bizad.background_color || BIZAD_DEFAULT_BACKGROUND_COLOR;
  const layers: Layer[] = [];
  let z = 0;
  let y = 72;
  const side = 80;
  const innerW = W - side * 2;
  const colW = (innerW - 32) / 2;
  const rowH = 96;
  const rowGap = 24;

  if (bizad.business_name) {
    layers.push(
      text(pageId, z++, bizad.business_name.toUpperCase(), {
        x: side,
        y,
        w: innerW,
        h: 80,
        size: 48,
        weight: 800,
        color: "#ffffff",
      }),
    );
    y += 92;
  }

  if (bizad.flyer_image_url) {
    const heroW = Math.round(innerW * 0.86);
    const heroH = Math.round(heroW * 1.28);
    const heroX = side + (innerW - heroW) / 2;
    const pad = 12;
    layers.push({
      ...defaultLayer("shape", pageId, z++),
      position: { x: heroX - pad, y: y - pad },
      size: { width: heroW + pad * 2, height: heroH + pad * 2 },
      style: { fill: "#ffffff", cornerRadius: 20 },
      content: {},
      action: null,
    });
    layers.push({
      ...defaultLayer("image", pageId, z++),
      position: { x: heroX, y },
      size: { width: heroW, height: heroH },
      content: { src: bizad.flyer_image_url },
      style: { cornerRadius: 16, objectFit: "cover" },
      action: bizad.gallery_url ? act("open_url", { url: bizad.gallery_url, newTab: true }) : null,
    });
    y += heroH + pad + 24;
  }

  if (bizad.owner_name) {
    layers.push(
      text(pageId, z++, bizad.owner_name, {
        x: side,
        y,
        w: innerW,
        h: 48,
        size: 30,
        weight: 500,
        color: "#e2e8f0",
      }),
    );
    y += 64;
  }

  const rowButtons: Array<{ label: string; action: LayerAction | null; x: number }> = [];
  if (bizad.phone) {
    rowButtons.push({ label: "CALL", action: act("call", { phone: bizad.phone }), x: side });
    rowButtons.push({ label: "TEXT/SMS", action: act("sms", { phone: bizad.phone }), x: side + colW + 32 });
  }
  rowButtons.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    layers.push(
      button(pageId, z++, b.label, btnColor, {
        x: side + col * (colW + 32),
        y: y + row * (rowH + rowGap),
        w: colW,
        h: rowH,
      }, b.action),
    );
  });
  if (rowButtons.length) y += Math.ceil(rowButtons.length / 2) * (rowH + rowGap) + 8;

  const row2: Array<{ label: string; action: LayerAction | null }> = [];
  if (bizad.email) {
    row2.push({
      label: "EMAIL",
      action: act("open_url", { url: `mailto:${bizad.email}`, newTab: false }),
    });
  }
  if (bizad.gallery_url) {
    row2.push({
      label: "FLYER",
      action: act("open_url", { url: bizad.gallery_url, newTab: true }),
    });
  }
  row2.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    layers.push(
      button(pageId, z++, b.label, btnColor, {
        x: side + col * (colW + 32),
        y: y + row * (rowH + rowGap),
        w: colW,
        h: rowH,
      }, b.action),
    );
  });
  if (row2.length) y += Math.ceil(row2.length / 2) * (rowH + rowGap) + 16;

  if (bizad.about_text) {
    layers.push(
      text(pageId, z++, bizad.about_text, {
        x: side,
        y,
        w: innerW,
        h: 180,
        size: 22,
        weight: 400,
        color: "#cbd5e1",
      }),
    );
    y += 196;
  }

  const galleryImage = bizad.owner_photo_url?.trim() || null;
  if (galleryImage && galleryImage !== bizad.flyer_image_url) {
    layers.push({
      ...defaultLayer("image", pageId, z++),
      position: { x: side, y },
      size: { width: innerW, height: 420 },
      content: { src: galleryImage },
      style: { cornerRadius: 20 },
      action: bizad.gallery_url ? act("open_url", { url: bizad.gallery_url, newTab: true }) : null,
    });
    y += 448;
  }

  const row3: Array<{ label: string; action: LayerAction | null }> = [];
  const galleryTarget = bizad.social_links?.website || bizad.gallery_url;
  if (galleryTarget) {
    row3.push({ label: "GALLERY", action: act("open_url", { url: galleryTarget, newTab: true }) });
  }
  row3.push({ label: "BOOKING", action: act("book_appointment", { title: "Book appointment" }) });
  row3.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    layers.push(
      button(pageId, z++, b.label, btnColor, {
        x: side + col * (colW + 32),
        y: y + row * (rowH + rowGap),
        w: colW,
        h: rowH,
      }, b.action),
    );
  });
  y += Math.ceil(row3.length / 2) * (rowH + rowGap) + 24;

  if (bizad.slug) {
    const qrSize = 280;
    layers.push({
      ...defaultLayer("image", pageId, z++),
      position: { x: (W - qrSize) / 2, y },
      size: { width: qrSize, height: qrSize },
      content: { src: buildBizadQrImageUrl(bizad.slug, qrSize) },
      style: { cornerRadius: 12 },
    });
    y += qrSize + 24;
  }

  const copyright =
    bizad.copyright_text?.trim() ||
    (bizad.business_name ? `COPYRIGHT © ${bizad.business_name.toUpperCase()} ${new Date().getFullYear()}` : null);
  if (copyright) {
    layers.push(
      text(pageId, z++, copyright, { x: side, y, w: innerW, h: 40, size: 18, weight: 500, color: "#94a3b8" }),
    );
    y += 56;
  }

  const height = Math.max(BIZAD_PAGE_HEIGHT, Math.round(y + 80));

  return {
    id: pageId,
    flyer_id: flyerId,
    index,
    name: BIZAD_PAGE_NAME,
    background: {
      color: bgColor,
      size: { width: W, height },
      bizadPage: true,
      bizadHidden: !bizad.enabled,
      bizadLayoutSource: VONTASTIC_TEMPLATE_ID,
    },
    layers,
  };
}
