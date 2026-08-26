import type { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import type { BizadRecord } from "@/lib/bizad";
import { buildBizadQrImageUrl } from "@/lib/bizadLayoutUtils";
import { buildSharePopupAction } from "@/lib/bizadTemplates/share";
import {
  BIZAD_PAGE_HEIGHT,
  BIZAD_PAGE_WIDTH,
  act,
  button,
  image,
  normalizeUrl,
  shape,
  text,
} from "@/lib/bizadTemplates/kit";

export const GRADIENT_PROFILE_TEMPLATE_ID = "gradient_profile_v1";
export const GRADIENT_PROFILE_DEFAULT_FROM = "#2563eb";
export const GRADIENT_PROFILE_DEFAULT_TO = "#7c3aed";

/** Template 01 — Gradient Profile: cover image, circular portrait, stacked pill actions. */
export function buildGradientProfilePage(flyerId: string, index: number, bizad: BizadRecord): FlyerPage {
  const pageId = uid();
  const W = BIZAD_PAGE_WIDTH;
  const from = bizad.gradient_from || GRADIENT_PROFILE_DEFAULT_FROM;
  const to = bizad.gradient_to || GRADIENT_PROFILE_DEFAULT_TO;
  const pill = "rgba(255,255,255,0.16)";
  const layers: Layer[] = [];
  let z = 1; // gradient background shape is added last at z 0
  const side = 90;
  const innerW = W - side * 2;

  const cover = bizad.cover_image_url?.trim() || bizad.flyer_image_url?.trim() || null;
  const coverH = 560;
  let y = 0;

  if (cover) {
    layers.push(image(pageId, z++, cover, { x: 0, y: 0, w: W, h: coverH, objectFit: "cover" }));
    y = coverH;
  } else {
    y = 200;
  }

  const portrait = bizad.owner_photo_url?.trim() || bizad.logo_url?.trim() || null;
  const pSize = 260;
  const pX = (W - pSize) / 2;
  const pY = y - pSize / 2;
  if (portrait) {
    layers.push(shape(pageId, z++, { x: pX - 10, y: pY - 10, w: pSize + 20, h: pSize + 20, fill: "#ffffff", cornerRadius: (pSize + 20) / 2 }));
    layers.push(image(pageId, z++, portrait, { x: pX, y: pY, w: pSize, h: pSize, cornerRadius: pSize / 2, objectFit: "cover" }));
    y = pY + pSize + 40;
  } else {
    y += 60;
  }

  if (bizad.owner_name || bizad.business_name) {
    layers.push(
      text(pageId, z++, bizad.owner_name?.trim() || bizad.business_name!.trim(), {
        x: side, y, w: innerW, h: 74, size: 56, weight: 800, color: "#ffffff",
      }),
    );
    y += 82;
  }
  if (bizad.job_title?.trim()) {
    layers.push(text(pageId, z++, bizad.job_title.trim(), { x: side, y, w: innerW, h: 48, size: 30, weight: 600, color: "#e9d5ff" }));
    y += 54;
  }
  const company = bizad.company_name?.trim() || bizad.business_name?.trim();
  if (company) {
    layers.push(text(pageId, z++, company, { x: side, y, w: innerW, h: 44, size: 26, weight: 500, color: "#dbeafe" }));
    y += 52;
  }
  if (bizad.about_text?.trim()) {
    layers.push(text(pageId, z++, bizad.about_text.trim(), { x: side, y, w: innerW, h: 150, size: 22, weight: 400, color: "#eef2ff" }));
    y += 168;
  }

  y += 24;
  const pills: Array<{ label: string; action: LayerAction }> = [];
  if (bizad.phone?.trim()) pills.push({ label: "Phone", action: act("call", { phone: bizad.phone.trim() }) });
  if (bizad.email?.trim()) pills.push({ label: "Email", action: act("open_url", { url: `mailto:${bizad.email.trim()}`, newTab: false }) });
  const website = normalizeUrl(bizad.social_links?.website) || normalizeUrl(bizad.gallery_url);
  if (website) pills.push({ label: "Website", action: act("open_url", { url: website, newTab: true }) });
  const customUrl = normalizeUrl(bizad.custom_link_url);
  if (customUrl) {
    pills.push({ label: bizad.custom_link_label?.trim() || "Business Link", action: act("open_url", { url: customUrl, newTab: true }) });
  }
  const bookingUrl = normalizeUrl(bizad.booking_url);
  pills.push({
    label: "Schedule / Book",
    action: bookingUrl
      ? act("open_url", { url: bookingUrl, newTab: true })
      : act("book_appointment", { title: "Book appointment" }),
  });

  const pillH = 112;
  const pillGap = 24;
  pills.forEach((p) => {
    layers.push(
      button(pageId, z++, p.label, pill, { x: side, y, w: innerW, h: pillH }, p.action, {
        cornerRadius: pillH / 2,
        fontSize: 30,
        fontWeight: 700,
      }),
    );
    y += pillH + pillGap;
  });

  y += 16;
  const halfW = (innerW - 24) / 2;
  layers.push(
    button(pageId, z++, "Share", "#ffffff", { x: side, y, w: halfW, h: 108 }, buildSharePopupAction(bizad), {
      cornerRadius: 54, textColor: from, fontSize: 28,
    }),
  );
  layers.push(
    button(pageId, z++, "Save Contact", "#0f172a", { x: side + halfW + 24, y, w: halfW, h: 108 },
      act("download_vcard", { title: "Save contact" }), { cornerRadius: 54, fontSize: 28 }),
  );
  y += 132;

  if (bizad.slug) {
    const qr = 260;
    layers.push(shape(pageId, z++, { x: (W - qr - 32) / 2, y, w: qr + 32, h: qr + 32, fill: "#ffffff", cornerRadius: 24 }));
    layers.push(image(pageId, z++, buildBizadQrImageUrl(bizad.slug, 512), { x: (W - qr) / 2, y: y + 16, w: qr, h: qr, objectFit: "contain" }));
    y += qr + 56;
  }

  const copyright =
    bizad.copyright_text?.trim() ||
    (company ? `© ${company} ${new Date().getFullYear()}` : null);
  if (copyright) {
    layers.push(text(pageId, z++, copyright, { x: side, y, w: innerW, h: 40, size: 18, weight: 500, color: "#e2e8f0" }));
    y += 56;
  }

  const height = Math.max(BIZAD_PAGE_HEIGHT, Math.round(y + 60));
  layers.unshift(shape(pageId, 0, { x: 0, y: 0, w: W, h: height, fill: from, gradientFrom: from, gradientTo: to }));

  return {
    id: pageId,
    flyer_id: flyerId,
    index,
    name: "Digital business card",
    background: {
      color: from,
      size: { width: W, height },
      bizadPage: true,
      bizadHidden: !bizad.enabled,
      bizadLayoutSource: GRADIENT_PROFILE_TEMPLATE_ID,
    },
    layers,
  };
}
