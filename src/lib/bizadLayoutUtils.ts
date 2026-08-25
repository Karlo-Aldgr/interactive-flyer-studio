import { buildPublicBizadUrl } from "@/lib/utils";
import type { BizadLayout } from "@/lib/bizadPage";

export const BIZAD_LAYOUT_SOURCE = "vontastic_v1";

/** Minimum layer count for a hand-customized card we should not auto-reset. */
const HAND_EDITED_LAYER_THRESHOLD = 10;

export function buildBizadQrImageUrl(slug: string, size = 400): string {
  const target = buildPublicBizadUrl(slug);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`;
}

export function shouldOfferBizadLayoutReset(layout: unknown): boolean {
  if (!layout) return true;
  const l = layout as BizadLayout & { source?: string };
  if (l.source === BIZAD_LAYOUT_SOURCE) return false;
  if (Array.isArray(l.layers) && l.layers.length >= HAND_EDITED_LAYER_THRESHOLD) return false;
  return true;
}
