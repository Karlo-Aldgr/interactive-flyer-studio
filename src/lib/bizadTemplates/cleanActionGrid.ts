import type { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import type { BizadRecord } from "@/lib/bizad";
import { buildBizadQrImageUrl } from "@/lib/bizadLayoutUtils";
import { buildSharePopupAction, setupRequiredAction } from "@/lib/bizadTemplates/share";
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

export const CLEAN_GRID_TEMPLATE_ID = "clean_action_grid_v1";
export const CLEAN_GRID_DEFAULT_ACCENT = "#dc2626";

/** Template 02 — Clean Action Grid: light card, logo header, tiled actions, about + footer. */
export function buildCleanActionGridPage(flyerId: string, index: number, bizad: BizadRecord): FlyerPage {
  const pageId = uid();
  const W = BIZAD_PAGE_WIDTH;
  const accent = bizad.accent_color || bizad.button_color || CLEAN_GRID_DEFAULT_ACCENT;
  const layers: Layer[] = [];
  let z = 1; // base surface added last at z 0
  const side = 72;
  const innerW = W - side * 2;
  let y = 0;

  // Header band
  const headerH = 380;
  layers.push(shape(pageId, z++, { x: 0, y: 0, w: W, h: headerH, fill: accent }));
  const header = bizad.cover_image_url?.trim() || bizad.logo_url?.trim() || null;
  if (header) {
    const hw = Math.round(innerW * 0.72);
    const hh = 220;
    layers.push(image(pageId, z++, header, { x: (W - hw) / 2, y: 62, w: hw, h: hh, objectFit: "contain", cornerRadius: 16 }));
  } else if (bizad.business_name) {
    layers.push(text(pageId, z++, bizad.business_name.toUpperCase(), { x: side, y: 130, w: innerW, h: 90, size: 54, weight: 800, color: "#ffffff" }));
  }
  y = headerH;

  // Profile photo overlapping the header
  const portrait = bizad.owner_photo_url?.trim() || bizad.flyer_image_url?.trim() || null;
  if (portrait) {
    const p = 220;
    const px = (W - p) / 2;
    const py = y - p / 2;
    layers.push(shape(pageId, z++, { x: px - 10, y: py - 10, w: p + 20, h: p + 20, fill: "#ffffff", cornerRadius: (p + 20) / 2 }));
    layers.push(image(pageId, z++, portrait, { x: px, y: py, w: p, h: p, cornerRadius: p / 2, objectFit: "cover" }));
    y = py + p + 36;
  } else {
    y += 48;
  }

  if (bizad.owner_name?.trim() || bizad.business_name?.trim()) {
    layers.push(text(pageId, z++, (bizad.owner_name?.trim() || bizad.business_name!.trim()), {
      x: side, y, w: innerW, h: 68, size: 50, weight: 800, color: "#0f172a",
    }));
    y += 76;
  }
  if (bizad.job_title?.trim()) {
    layers.push(text(pageId, z++, bizad.job_title.trim(), { x: side, y, w: innerW, h: 44, size: 28, weight: 600, color: accent }));
    y += 50;
  }
  const company = bizad.company_name?.trim() || bizad.business_name?.trim();
  if (company) {
    layers.push(text(pageId, z++, company, { x: side, y, w: innerW, h: 42, size: 24, weight: 500, color: "#475569" }));
    y += 56;
  }

  // Action tiles
  type Tile = { label: string; action: LayerAction };
  const tiles: Tile[] = [];
  if (bizad.phone?.trim()) {
    tiles.push({ label: "CALL", action: act("call", { phone: bizad.phone.trim() }) });
    tiles.push({ label: "TEXT / SMS", action: act("sms", { phone: bizad.phone.trim() }) });
  }
  if (bizad.email?.trim()) {
    tiles.push({ label: "EMAIL", action: act("open_url", { url: `mailto:${bizad.email.trim()}`, newTab: false }) });
  }
  const social = bizad.social_links || {};
  const externals: Array<[string, string | null | undefined]> = [
    ["FACEBOOK", social.facebook],
    ["YOUTUBE", social.youtube],
    ["WEBSITE", social.website || bizad.gallery_url],
    ["TIKTOK", social.tiktok],
    ["INSTAGRAM", social.instagram],
  ];
  externals.forEach(([label, raw]) => {
    const url = normalizeUrl(raw);
    tiles.push({
      label: url ? label : `${label}\nSetup Required`,
      action: url ? act("open_url", { url, newTab: true }) : setupRequiredAction(label.toLowerCase()),
    });
  });
  const customUrl = normalizeUrl(bizad.custom_link_url);
  if (customUrl) {
    tiles.push({ label: (bizad.custom_link_label?.trim() || "BUSINESS LINK").toUpperCase(), action: act("open_url", { url: customUrl, newTab: true }) });
  }
  const bookingUrl = normalizeUrl(bizad.booking_url);
  tiles.push({
    label: "BOOK",
    action: bookingUrl ? act("open_url", { url: bookingUrl, newTab: true }) : act("book_appointment", { title: "Book appointment" }),
  });
  if (bizad.address?.trim()) {
    tiles.push({ label: "DIRECTIONS", action: act("map", { mapAddress: bizad.address.trim() }) });
  }
  tiles.push({ label: "SAVE CONTACT", action: act("download_vcard", { title: "Save contact" }) });
  tiles.push({ label: "SHARE", action: buildSharePopupAction(bizad) });

  const cols = 3;
  const gap = 24;
  const tileW = (innerW - gap * (cols - 1)) / cols;
  const tileH = 190;
  tiles.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    layers.push(
      button(pageId, z++, t.label, accent, {
        x: side + col * (tileW + gap),
        y: y + row * (tileH + gap),
        w: tileW,
        h: tileH,
      }, t.action, { cornerRadius: 28, fontSize: 22, fontWeight: 700 }),
    );
  });
  y += Math.ceil(tiles.length / cols) * (tileH + gap) + 24;

  // Expandable About
  if (bizad.about_text?.trim()) {
    layers.push(
      button(pageId, z++, "ABOUT  ▾", "#0f172a", { x: side, y, w: innerW, h: 104 },
        act("popup", { title: company ? `About ${company}` : "About", body: bizad.about_text.trim() }),
        { cornerRadius: 24, fontSize: 26 }),
    );
    y += 132;
  }

  // Branded footer
  const footerTop = y;
  const secondary = bizad.flyer_image_url?.trim() && bizad.flyer_image_url !== portrait ? bizad.flyer_image_url.trim() : null;
  if (secondary) {
    layers.push(image(pageId, z++, secondary, { x: side, y, w: innerW, h: 420, cornerRadius: 24, objectFit: "cover" },
      bizad.gallery_url ? act("open_url", { url: bizad.gallery_url, newTab: true }) : null));
    y += 452;
  }
  if (bizad.logo_url?.trim()) {
    const lw = 300;
    layers.push(image(pageId, z++, bizad.logo_url.trim(), { x: (W - lw) / 2, y, w: lw, h: 160, objectFit: "contain" }));
    y += 188;
  }
  if (bizad.slug) {
    const qr = 240;
    layers.push(image(pageId, z++, buildBizadQrImageUrl(bizad.slug, 512), { x: (W - qr) / 2, y, w: qr, h: qr, objectFit: "contain" }));
    y += qr + 28;
  }
  const copyright = bizad.copyright_text?.trim() || (company ? `© ${company} ${new Date().getFullYear()}` : null);
  if (copyright) {
    layers.push(text(pageId, z++, copyright, { x: side, y, w: innerW, h: 40, size: 18, weight: 500, color: "#64748b" }));
    y += 56;
  }
  void footerTop;

  const height = Math.max(BIZAD_PAGE_HEIGHT, Math.round(y + 60));
  layers.unshift(shape(pageId, 0, { x: 0, y: 0, w: W, h: height, fill: "#f8fafc" }));

  return {
    id: pageId,
    flyer_id: flyerId,
    index,
    name: "Digital business card",
    background: {
      color: "#f8fafc",
      size: { width: W, height },
      bizadPage: true,
      bizadHidden: !bizad.enabled,
      bizadLayoutSource: CLEAN_GRID_TEMPLATE_ID,
    },
    layers,
  };
}
