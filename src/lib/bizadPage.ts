import type { FlyerPage, FlyerSettings, Layer, PageIntro } from "@/types/flyer";
import { BIZAD_DEFAULT_BACKGROUND_COLOR } from "@/lib/bizadDefaults";
import { BIZAD_PAGE_HEIGHT, BIZAD_PAGE_WIDTH } from "@/lib/bizadTemplates/kit";
import { BIZAD_PAGE_NAME, buildBizadPage } from "@/lib/bizadTemplates";

export { BIZAD_PAGE_NAME, BIZAD_PAGE_WIDTH, BIZAD_PAGE_HEIGHT, buildBizadPage };

export const isBizadPage = (p: FlyerPage) => !!p.background?.bizadPage;

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
