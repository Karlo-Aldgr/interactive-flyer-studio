import { buildPublicBizadUrl } from "@/lib/utils";
import type { BizadLayout } from "@/lib/bizadPage";

export const BIZAD_LAYOUT_SOURCE = "vontastic_v1";

/** Minimum layer count for a hand-customized card we should not auto-reset. */
const HAND_EDITED_LAYER_THRESHOLD = 10;

export function buildBizadQrImageUrl(slug: string, size = 400): string {
  const target = buildPublicBizadUrl(slug);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`;
}

/** Hand-customized cards (e.g. Vontastic) — never auto-rebuild or offer reset. */
export function isHandEditedBizadLayout(layout: unknown): boolean {
  if (!layout) return false;
  const l = layout as BizadLayout & { source?: string };
  // Auto-generated standard cards always rebuild on save, even with 10+ layers.
  if (l.source === BIZAD_LAYOUT_SOURCE) return false;
  return Array.isArray(l.layers) && l.layers.length >= HAND_EDITED_LAYER_THRESHOLD;
}

/** Show "Reset to standard layout" unless the card was heavily customized in the editor. */
export function shouldOfferBizadLayoutReset(layout: unknown): boolean {
  return !isHandEditedBizadLayout(layout);
}

/** Rebuild saved layout from dialog settings on each save (colors, contact, copy, etc.). */
export function shouldRebuildBizadLayoutOnSave(layout: unknown): boolean {
  return !isHandEditedBizadLayout(layout);
}
