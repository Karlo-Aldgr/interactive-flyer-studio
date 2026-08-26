import type { Layer, LayerAction } from "@/types/flyer";
import { defaultLayer, uid } from "@/lib/konvaHelpers";

export const BIZAD_PAGE_WIDTH = 1080;
export const BIZAD_PAGE_HEIGHT = 1920;

/** Bizad buttons are obviously tappable — skip flyer-style pulse rings on the live card. */
export function act(type: LayerAction["type"], payload: LayerAction["payload"]): LayerAction {
  return {
    id: uid(),
    type,
    payload,
    highlight: { enabled: false, style: "none" },
  };
}

export type Box = { x: number; y: number; w: number; h: number };

export function text(
  pageId: string,
  z: number,
  value: string,
  opts: Box & {
    size: number;
    weight?: number;
    color?: string;
    align?: "left" | "center" | "right";
    fontFamily?: string;
  },
): Layer {
  return {
    ...defaultLayer("text", pageId, z),
    position: { x: opts.x, y: opts.y },
    size: { width: opts.w, height: opts.h },
    style: {
      fontFamily: opts.fontFamily ?? "Plus Jakarta Sans",
      fontSize: opts.size,
      fontWeight: opts.weight ?? 600,
      color: opts.color ?? "#ffffff",
      align: opts.align ?? "center",
    },
    content: { text: value },
  };
}

export function button(
  pageId: string,
  z: number,
  label: string,
  color: string,
  opts: Box,
  action: LayerAction | null,
  extra?: { textColor?: string; cornerRadius?: number; fontSize?: number; fontWeight?: number },
): Layer {
  return {
    ...defaultLayer("button", pageId, z),
    position: { x: opts.x, y: opts.y },
    size: { width: opts.w, height: opts.h },
    style: {
      fill: color,
      color: extra?.textColor ?? "#ffffff",
      cornerRadius: extra?.cornerRadius ?? 28,
      fontSize: extra?.fontSize ?? 26,
      fontWeight: extra?.fontWeight ?? 700,
      align: "center",
    },
    content: { label },
    action,
  };
}

export function shape(
  pageId: string,
  z: number,
  opts: Box & {
    fill?: string;
    cornerRadius?: number;
    gradientFrom?: string;
    gradientTo?: string;
  },
): Layer {
  return {
    ...defaultLayer("shape", pageId, z),
    position: { x: opts.x, y: opts.y },
    size: { width: opts.w, height: opts.h },
    style: {
      fill: opts.fill ?? "#ffffff",
      cornerRadius: opts.cornerRadius ?? 0,
      gradientFrom: opts.gradientFrom,
      gradientTo: opts.gradientTo,
    },
    content: {},
    action: null,
  };
}

export function image(
  pageId: string,
  z: number,
  src: string,
  opts: Box & { cornerRadius?: number; objectFit?: "cover" | "contain" },
  action: LayerAction | null = null,
): Layer {
  return {
    ...defaultLayer("image", pageId, z),
    position: { x: opts.x, y: opts.y },
    size: { width: opts.w, height: opts.h },
    content: { src },
    style: {
      cornerRadius: opts.cornerRadius ?? 0,
      objectFit: opts.objectFit ?? "cover",
      fit: (opts.objectFit ?? "cover") === "cover" ? "cover" : "fill",
    },
    action,
  };
}

export function mailtoAction(email: string): LayerAction {
  return act("open_url", { url: `mailto:${email}`, newTab: false });
}

export function urlAction(url: string): LayerAction {
  return act("open_url", { url, newTab: true });
}

/** Normalize a user-entered link so open_url always gets an absolute URL. */
export function normalizeUrl(raw?: string | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^(https?:|mailto:|tel:|sms:)/i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}
