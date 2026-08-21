import type { FlyerPage, FlyerSettings, Layer, LayerAction, PageIntro } from "@/types/flyer";
import { defaultLayer, uid } from "@/lib/konvaHelpers";
import type { BizadRecord } from "@/lib/bizad";
import { buildMapsUrl } from "@/lib/bizad";

export const BIZAD_PAGE_NAME = "Digital business card";
export const BIZAD_PAGE_WIDTH = 800;
export const BIZAD_PAGE_HEIGHT = 1400;

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
      color: opts.color ?? "#0f172a",
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
    style: { fill: color, color: "#ffffff", cornerRadius: 18, fontSize: 20, fontWeight: 600, align: "center" },
    content: { label },
    action,
  };
}

/** Builds an editable editor page that mirrors the digital business card. */
export function buildBizadPage(flyerId: string, index: number, bizad: BizadRecord): FlyerPage {
  const pageId = uid();
  const W = BIZAD_PAGE_WIDTH;
  const color = bizad.button_color || "#2563eb";
  const layers: Layer[] = [];
  let z = 0;
  let y = 60;

  if (bizad.logo_url) {
    layers.push({
      ...defaultLayer("image", pageId, z++),
      position: { x: (W - 200) / 2, y },
      size: { width: 200, height: 200 },
      content: { src: bizad.logo_url },
      style: { cornerRadius: 100 },
    });
    y += 230;
  }

  if (bizad.business_name) {
    layers.push(text(pageId, z++, bizad.business_name, { x: 60, y, w: W - 120, h: 54, size: 40, weight: 800 }));
    y += 64;
  }
  if (bizad.owner_name) {
    layers.push(
      text(pageId, z++, bizad.owner_name, { x: 60, y, w: W - 120, h: 36, size: 24, weight: 500, color: "#475569" }),
    );
    y += 48;
  }
  if (bizad.about_text) {
    layers.push(
      text(pageId, z++, bizad.about_text, { x: 60, y, w: W - 120, h: 110, size: 18, weight: 400, color: "#475569" }),
    );
    y += 130;
  }

  // Contact buttons — two per row.
  const entries: Array<{ label: string; action: LayerAction | null }> = [];
  if (bizad.phone) entries.push({ label: "Call", action: act("call", { phone: bizad.phone }) });
  if (bizad.phone) entries.push({ label: "Text", action: act("sms", { phone: bizad.phone }) });
  if (bizad.email)
    entries.push({ label: "Email", action: act("open_url", { url: `mailto:${bizad.email}`, newTab: false }) });
  if (bizad.address)
    entries.push({ label: "Directions", action: act("open_url", { url: buildMapsUrl(bizad.address), newTab: true }) });
  if (bizad.gallery_url)
    entries.push({ label: "View flyer", action: act("open_url", { url: bizad.gallery_url, newTab: true }) });
  if (bizad.video_url)
    entries.push({ label: "Watch video", action: act("video", { videoUrl: bizad.video_url }) });

  const bw = (W - 120 - 24) / 2;
  entries.forEach((e, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    layers.push(
      button(pageId, z++, e.label, color, { x: 60 + col * (bw + 24), y: y + row * 92, w: bw, h: 72 }, e.action),
    );
  });
  y += Math.ceil(entries.length / 2) * 92 + 20;

  // Social buttons.
  const socials = bizad.social_links || {};
  const socialEntries = [
    { label: "Website", url: socials.website },
    { label: "Facebook", url: socials.facebook },
    { label: "Instagram", url: socials.instagram },
    { label: "TikTok", url: socials.tiktok },
    { label: "More", url: socials.other },
  ].filter((s) => !!s.url) as Array<{ label: string; url: string }>;

  socialEntries.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    layers.push(
      button(pageId, z++, s.label, "#0f172a", { x: 60 + col * (bw + 24), y: y + row * 82, w: bw, h: 62 },
        act("open_url", { url: s.url, newTab: true })),
    );
  });
  y += Math.ceil(socialEntries.length / 2) * 82 + 20;

  if (bizad.flyer_image_url) {
    layers.push({
      ...defaultLayer("image", pageId, z++),
      position: { x: 60, y },
      size: { width: W - 120, height: 420 },
      content: { src: bizad.flyer_image_url },
      style: { cornerRadius: 18 },
      action: bizad.gallery_url ? act("open_url", { url: bizad.gallery_url, newTab: true }) : null,
    });
    y += 450;
  }

  if (bizad.copyright_text) {
    layers.push(
      text(pageId, z++, bizad.copyright_text, { x: 60, y, w: W - 120, h: 32, size: 14, weight: 400, color: "#94a3b8" }),
    );
    y += 50;
  }

  const height = Math.max(BIZAD_PAGE_HEIGHT, Math.round(y + 60));

  return {
    id: pageId,
    flyer_id: flyerId,
    index,
    name: BIZAD_PAGE_NAME,
    background: {
      color: bizad.background_color || "#ffffff",
      size: { width: W, height },
      bizadPage: true,
      bizadHidden: !bizad.enabled,
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
  /** Page-level intro animation, mirrored from the flyer editor page. */
  intro?: PageIntro | null;
  /** Intro + background audio copied from the flyer settings. */
  audio?: BizadAudioSettings | null;
};

/** Picks only the audio-related flyer settings shared with the business card. */
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
    background: page.background?.color ?? "#ffffff",
    backgroundImage: page.background?.image ?? null,
    layers: page.layers,
    intro: page.intro ?? null,
    audio: audioSettingsFromFlyer(settings),
  };
}
