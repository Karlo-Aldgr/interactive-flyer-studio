import type { FlyerPage, FlyerSettings, Layer, LayerAction, PageIntro } from "@/types/flyer";
import { defaultLayer, uid } from "@/lib/konvaHelpers";
import type { BizadRecord } from "@/lib/bizad";
import { BIZAD_DEFAULT_BACKGROUND_COLOR, BIZAD_DEFAULT_BUTTON_COLOR } from "@/lib/bizadDefaults";
import { BIZAD_LAYOUT_SOURCE, buildBizadQrImageUrl } from "@/lib/bizadLayoutUtils";

export const BIZAD_PAGE_NAME = "Digital business card";
export const BIZAD_PAGE_WIDTH = 1080;
export const BIZAD_PAGE_HEIGHT = 1920;

export const isBizadPage = (p: FlyerPage) => !!p.background?.bizadPage;

function act(type: LayerAction["type"], payload: LayerAction["payload"]): LayerAction {
  return { id: uid(), type, payload };
}

function text(
  pageId: string,
  z: number,
  value: string,
  opts: { x: number; y: number; w: number; h: number; size: number; weight?: number; color?: string },
): Layer {
  return {
    ...defaultLayer("text", pageId, z),
    position: { x: opts.x, y: opts.y },
    size: { width: opts.w, height: opts.h },
    style: {
      fontFamily: "Plus Jakarta Sans",
      fontSize: opts.size,
      fontWeight: opts.weight ?? 600,
      color: opts.color ?? "#ffffff",
      align: "center",
    },
    content: { text: value },
  };
}

function button(
  pageId: string,
  z: number,
  label: string,
  color: string,
  opts: { x: number; y: number; w: number; h: number },
  action: LayerAction | null,
): Layer {
  return {
    ...defaultLayer("button", pageId, z),
    position: { x: opts.x, y: opts.y },
    size: { width: opts.w, height: opts.h },
    style: { fill: color, color: "#ffffff", cornerRadius: 28, fontSize: 26, fontWeight: 700, align: "center" },
    content: { label },
    action,
  };
}

/** Vontastic-style digital business card editor page (standard default for new cards). */
export function buildBizadPage(flyerId: string, index: number, bizad: BizadRecord): FlyerPage {
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
      bizadLayoutSource: BIZAD_LAYOUT_SOURCE,
    },
    layers,
  };
}

export type BizadAudioSettings = {
  introAudioUrl?: string;
  introAudioLoop?: boolean;
  introAudioVolume?: number;
  introAudioShowControl?: boolean;
  bgAudioUrl?: string;
  bgAudioLoop?: boolean;
  bgAudioVolume?: number;
  bgAudioAutoplay?: boolean;
  bgAudioShowControl?: boolean;
};

export type BizadLayout = {
  width: number;
  height: number;
  background: string;
  backgroundImage?: string | null;
  layers: Layer[];
  intro?: PageIntro | null;
  audio?: BizadAudioSettings | null;
  source?: string;
};

export function audioSettingsFromFlyer(settings?: FlyerSettings | null): BizadAudioSettings {
  return {
    introAudioUrl: settings?.introAudioUrl,
    introAudioLoop: settings?.introAudioLoop,
    introAudioVolume: settings?.introAudioVolume,
    introAudioShowControl: settings?.introAudioShowControl,
    bgAudioUrl: settings?.bgAudioUrl,
    bgAudioLoop: settings?.bgAudioLoop,
    bgAudioVolume: settings?.bgAudioVolume,
    bgAudioAutoplay: settings?.bgAudioAutoplay,
    bgAudioShowControl: settings?.bgAudioShowControl,
  };
}

export function layoutFromPage(page: FlyerPage, settings?: FlyerSettings | null): BizadLayout {
  return {
    width: page.background?.size?.width ?? BIZAD_PAGE_WIDTH,
    height: page.background?.size?.height ?? BIZAD_PAGE_HEIGHT,
    background: page.background?.color ?? BIZAD_DEFAULT_BACKGROUND_COLOR,
    backgroundImage: page.background?.image ?? null,
    layers: page.layers,
    intro: page.intro ?? null,
    audio: audioSettingsFromFlyer(settings),
    source: page.background?.bizadLayoutSource ?? undefined,
  };
}
