import type { ActionPayload, FlyerSettings, LayerAction } from "@/types/flyer";
import { safeUUID } from "@/lib/safeBrowser";

export const GODS_WARRIOR_FLYER_IMAGE = "/landing/flyer-warrior.png";

export const GODS_WARRIOR_CANVAS: FlyerSettings = {
  width: 900,
  height: 1200,
  background: "#111827",
  highlightsEnabled: true,
};

type TemplateHotspot = {
  position: { x: number; y: number };
  size: { width: number; height: number };
  action: LayerAction;
};

function colorGalleryAction(): LayerAction {
  const img = GODS_WARRIOR_FLYER_IMAGE;
  return {
    id: safeUUID(),
    type: "gallery",
    payload: {
      galleryTitle: "God's Warrior — Color Options",
      galleryImages: [
        { id: safeUUID(), url: img, caption: "Pink Polo — featured" },
        { id: safeUUID(), url: img, caption: "Black Edition" },
        { id: safeUUID(), url: img, caption: "White Edition" },
        { id: safeUUID(), url: img, caption: "Olive Edition" },
      ],
    } satisfies ActionPayload,
  };
}

function subscribeReleaseAction(): LayerAction {
  return {
    id: safeUUID(),
    type: "subscribe",
    payload: {
      subscribeTitle: "Official release list",
      subscribeBody: "Get the launch date for God's Warrior apparel before anyone else.",
      subscribeButtonLabel: "Notify me",
      subscribeListName: "God's Warrior Launch",
      subscribeSuccessMessage: "You're on the list — we'll email you at launch.",
    } satisfies ActionPayload,
  };
}

function modelPopupAction(): LayerAction {
  return {
    id: safeUUID(),
    type: "popup",
    payload: {
      title: "God's Warrior Colors",
      body: "Tap below to browse color options, or join the list for the official release date.",
      mediaUrl: GODS_WARRIOR_FLYER_IMAGE,
      popupBgColor: "#111827",
      popupTextColor: "#f9fafb",
      buttons: [
        {
          id: safeUUID(),
          label: "View color options",
          style: "primary",
          bgColor: "#ec4899",
          textColor: "#ffffff",
          action: colorGalleryAction(),
        },
        {
          id: safeUUID(),
          label: "Get release date",
          style: "secondary",
          bgColor: "#374151",
          textColor: "#ffffff",
          action: subscribeReleaseAction(),
        },
      ],
    } satisfies ActionPayload,
  };
}

/** Pre-wired hotspots for the magazine flyer (900×1200 canvas). */
export const GODS_WARRIOR_HOTSPOTS: TemplateHotspot[] = [
  {
    position: { x: 255, y: 395 },
    size: { width: 390, height: 430 },
    action: modelPopupAction(),
  },
  {
    position: { x: 470, y: 1095 },
    size: { width: 400, height: 72 },
    action: {
      id: safeUUID(),
      type: "open_url",
      payload: {
        url: "https://godswarrior.com",
        newTab: true,
      } satisfies ActionPayload,
    },
  },
  {
    position: { x: 70, y: 1005 },
    size: { width: 300, height: 70 },
    action: subscribeReleaseAction(),
  },
];

export const GODS_WARRIOR_META = {
  title: "God's Warrior — Summer 2025",
  thumbnailUrl: GODS_WARRIOR_FLYER_IMAGE,
  suggestedSlug: "gods-warrior",
  category: "business" as const,
};
