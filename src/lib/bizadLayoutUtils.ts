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

/* ------------------------------------------------------------------ */
/* Center / tidy a business card layout                                */
/* ------------------------------------------------------------------ */

type CenterableLayer = {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
};

/** Layers this wide (relative to the card) are treated as intentional full-bleed. */
const FULL_BLEED_RATIO = 0.98;
/** Buttons whose tops are within this many px belong to the same row. */
const ROW_TOLERANCE = 40;

const r = (n: number) => Math.round(n);

/**
 * Returns position patches that horizontally center a business card's layers:
 * - full-bleed layers snap to x = 0 with the exact card width
 * - button rows get equal side margins, equal gutters and one shared y
 * - everything else is centered on the card
 */
export function centerBizadLayerPatches<T extends CenterableLayer>(
  layers: T[],
  pageWidth: number,
): Record<string, { position: { x: number; y: number }; size: { width: number; height: number } }> {
  const patches: Record<string, { position: { x: number; y: number }; size: { width: number; height: number } }> = {};
  if (!layers.length || !pageWidth) return patches;

  const put = (l: CenterableLayer, x: number, y: number, w = l.size.width, h = l.size.height) => {
    if (r(x) === r(l.position.x) && r(y) === r(l.position.y) && r(w) === r(l.size.width) && r(h) === r(l.size.height)) return;
    patches[l.id] = { position: { x: r(x), y: r(y) }, size: { width: r(w), height: r(h) } };
  };

  const isBackdrop = (l: CenterableLayer) =>
    l.type === "shape" && l.size.width >= pageWidth * FULL_BLEED_RATIO && l.size.height > pageWidth;

  const buttons = layers.filter((l) => l.type === "button");
  const rest = layers.filter((l) => l.type !== "button");

  // 1. Non-button layers
  for (const l of rest) {
    if (isBackdrop(l)) {
      put(l, 0, l.position.y, pageWidth, l.size.height);
      continue;
    }
    if (l.size.width >= pageWidth * FULL_BLEED_RATIO) {
      const h = l.size.width > 0 ? l.size.height * (pageWidth / l.size.width) : l.size.height;
      put(l, 0, l.position.y, pageWidth, l.type === "image" ? h : l.size.height);
      continue;
    }
    /* Only recenter layers that are already meant to be centered (wide blocks,
       or elements sitting near the middle). Decorative off-center accents stay put. */
    const wide = l.size.width >= pageWidth * 0.6;
    const offset = Math.abs(l.position.x + l.size.width / 2 - pageWidth / 2);
    if (wide || offset <= pageWidth * 0.06) put(l, (pageWidth - l.size.width) / 2, l.position.y);
  }

  // 2. Button rows
  const sorted = [...buttons].sort((a, b) => a.position.y - b.position.y);
  const rows: T[][] = [];
  for (const b of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(b.position.y - row[0].position.y) <= ROW_TOLERANCE) row.push(b);
    else rows.push([b]);
  }

  for (const row of rows) {
    row.sort((a, b) => a.position.x - b.position.x);
    const y = Math.min(...row.map((b) => b.position.y));
    const total = row.reduce((s, b) => s + b.size.width, 0);
    if (row.length === 1) {
      put(row[0], (pageWidth - total) / 2, y);
      continue;
    }
    let margin = Math.max(0, Math.min(row[0].position.x, (pageWidth - total) / 2));
    let gutter = (pageWidth - margin * 2 - total) / (row.length - 1);
    if (gutter < 0) {
      margin = 0;
      gutter = Math.max(0, (pageWidth - total) / (row.length - 1));
    }
    let x = margin;
    for (const b of row) {
      put(b, x, y);
      x += b.size.width + gutter;
    }
  }

  return patches;
}
