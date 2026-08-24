import type { FlyerPage, Layer, LayerAction } from "@/types/flyer";

/**
 * Turns a SAVED Website page (pages/layers/actions, exactly as stored by the
 * editor) into a semantic, reflowable document that can be rendered as a real
 * responsive webpage outside the editor.
 *
 * Nothing is regenerated from the WaveX template here — every piece of content
 * comes from the saved layers, so manual edits are preserved.
 */

export type WebsiteBlockKind = "text" | "image" | "icon" | "button" | "video" | "divider" | "shape";

export interface WebsiteBlock {
  id: string;
  kind: WebsiteBlockKind;
  text?: string;
  src?: string;
  posterUrl?: string;
  iconName?: string;
  action?: LayerAction | null;
  /** Design-time geometry (used only for proportional reflow hints). */
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: string;
  fontFamily?: string;
  color?: string;
  align?: "left" | "center" | "right";
  fill?: string;
  radius?: number;
  opacity?: number;
}

export interface WebsiteCard {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  radius?: number;
  opacity?: number;
  stroke?: string;
  blocks: WebsiteBlock[];
}

export type WebsiteRow =
  | { kind: "grid"; id: string; cards: WebsiteCard[] }
  | { kind: "blocks"; id: string; blocks: WebsiteBlock[] };

export interface WebsiteSection {
  id: string;
  anchor: string;
  bgColor?: string;
  bgImage?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  rows: WebsiteRow[];
}

export interface WebsiteNavItem {
  label: string;
  anchor: string;
}

export interface WebsiteDocument {
  designWidth: number;
  contentWidth: number;
  bgColor: string;
  accent: string;
  fontFamily: string;
  brandName: string;
  logoUrl?: string;
  nav: WebsiteNavItem[];
  navCta?: { label: string; action?: LayerAction | null };
  sections: WebsiteSection[];
  footer?: WebsiteSection;
}

const isFullWidth = (l: Layer, W: number) => l.position.x <= 4 && l.size.width >= W - 8;
const centerY = (l: Layer) => l.position.y + l.size.height / 2;
const anchorOf = (a?: LayerAction | null) => {
  const url = a?.type === "open_url" ? (a.payload?.url ?? "") : "";
  return typeof url === "string" && url.startsWith("#") ? url.slice(1) : null;
};

function toBlock(l: Layer): WebsiteBlock {
  const kind: WebsiteBlockKind =
    l.type === "text"
      ? "text"
      : l.type === "image"
        ? "image"
        : l.type === "icon"
          ? "icon"
          : l.type === "button"
            ? "button"
            : l.type === "video"
              ? "video"
              : l.size.height <= 3
                ? "divider"
                : "shape";
  return {
    id: l.id,
    kind,
    text: l.content.text ?? l.content.label ?? l.style.label,
    src: l.content.src,
    posterUrl: l.content.posterUrl,
    iconName: l.content.iconName ?? l.style.iconName,
    action: l.action ?? null,
    x: l.position.x,
    y: l.position.y,
    w: l.size.width,
    h: l.size.height,
    fontSize: l.style.fontSize,
    fontWeight: l.style.fontWeight,
    fontStyle: l.style.fontStyle,
    fontFamily: l.style.fontFamily,
    color: l.style.color,
    align: l.style.align,
    fill: l.style.fill,
    radius: l.style.cornerRadius,
    opacity: l.style.opacity,
  };
}

/** Groups ordered units into rows: same row when their tops are close together. */
function rowsOf<T extends { y: number; h: number }>(units: T[], tolerance = 28): T[][] {
  const sorted = [...units].sort((a, b) => a.y - b.y || 0);
  const out: T[][] = [];
  for (const u of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(u.y - last[0].y) <= tolerance) last.push(u);
    else out.push([u]);
  }
  return out;
}

export function parseWebsiteDocument(page: FlyerPage): WebsiteDocument | null {
  if (!page?.background?.websitePage) return null;
  const W = page.background.size?.width || 1440;
  const layers = [...(page.layers ?? [])].sort((a, b) => a.z_index - b.z_index);
  if (!layers.length) return null;

  // Section bands = full-width background rectangles.
  const bands = layers
    .filter((l) => l.type === "shape" && isFullWidth(l, W) && l.size.height > 60)
    .sort((a, b) => a.position.y - b.position.y);

  const bandRanges = bands.map((b) => ({ layer: b, top: b.position.y, bottom: b.position.y + b.size.height }));
  const used = new Set(bands.map((b) => b.id));

  // Content padding is derived from the left-most non-full-width layer.
  const pad = Math.max(
    16,
    Math.min(...layers.filter((l) => !isFullWidth(l, W)).map((l) => l.position.x), 120) || 24
  );
  const contentWidth = Math.max(320, W - pad * 2);

  const navBand = bandRanges[0];
  const footerBand = bandRanges.length > 1 ? bandRanges[bandRanges.length - 1] : undefined;

  const inBand = (band: { top: number; bottom: number }, l: Layer) => {
    const c = centerY(l);
    return c >= band.top - 2 && c < band.bottom + 2;
  };

  /* ------------------------------------------------------------ nav */
  const navLayers = navBand ? layers.filter((l) => !used.has(l.id) && inBand(navBand, l)) : [];
  navLayers.forEach((l) => used.add(l.id));

  const navItems: WebsiteNavItem[] = [];
  navLayers
    .filter((l) => l.type === "text" && anchorOf(l.action))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .forEach((l) => {
      const anchor = anchorOf(l.action)!;
      const label = (l.content.text ?? "").trim();
      if (label && !navItems.some((n) => n.anchor === anchor)) navItems.push({ label, anchor });
    });

  const brandText = navLayers
    .filter((l) => l.type === "text" && !anchorOf(l.action))
    .sort((a, b) => b.style.fontSize! - a.style.fontSize! || a.position.x - b.position.x)[0];
  const logoLayer = navLayers.find((l) => l.type === "image");
  const navCtaLayer = navLayers.find((l) => l.type === "button");

  /* --------------------------------------------------------- sections */
  const contentBands = bandRanges.slice(1, footerBand ? bandRanges.length - 1 : undefined);
  const anchorQueue = navItems.map((n) => n.anchor);

  const buildSection = (band: { layer: Layer; top: number; bottom: number }, anchor: string): WebsiteSection => {
    const own = layers.filter((l) => !used.has(l.id) && inBand(band, l));
    own.forEach((l) => used.add(l.id));

    // Full-bleed background image + tint overlay (hero pattern).
    let bgImage: string | undefined;
    let overlayColor: string | undefined;
    let overlayOpacity: number | undefined;
    const rest: Layer[] = [];
    for (const l of own) {
      if (l.type === "image" && isFullWidth(l, W) && l.size.height >= band.bottom - band.top - 8 && !bgImage) {
        bgImage = l.content.src;
        continue;
      }
      if (l.type === "shape" && isFullWidth(l, W) && l.size.height >= band.bottom - band.top - 8) {
        overlayColor = l.style.fill;
        overlayOpacity = l.style.opacity ?? 0.6;
        continue;
      }
      rest.push(l);
    }

    // Cards = non-full-width rectangles that hold other layers.
    const cardLayers = rest.filter(
      (l) => l.type === "shape" && l.size.width >= 120 && l.size.height >= 60 && l.size.width < W * 0.92
    );
    const cardIds = new Set(cardLayers.map((l) => l.id));
    const cards: WebsiteCard[] = cardLayers.map((l) => ({
      id: l.id,
      x: l.position.x,
      y: l.position.y,
      w: l.size.width,
      h: l.size.height,
      fill: l.style.fill,
      radius: l.style.cornerRadius,
      opacity: l.style.opacity,
      stroke: l.style.stroke,
      blocks: [],
    }));

    const free: WebsiteBlock[] = [];
    for (const l of rest) {
      if (cardIds.has(l.id)) continue;
      const cx = l.position.x + l.size.width / 2;
      const cy = centerY(l);
      const host = cards
        .filter((c) => cx >= c.x - 2 && cx <= c.x + c.w + 2 && cy >= c.y - 2 && cy <= c.y + c.h + 2)
        .sort((a, b) => a.w * a.h - b.w * b.h)[0];
      if (host) host.blocks.push(toBlock(l));
      else free.push(toBlock(l));
    }
    cards.forEach((c) => c.blocks.sort((a, b) => a.y - b.y || a.x - b.x));

    type Unit = { y: number; h: number; card?: WebsiteCard; block?: WebsiteBlock };
    const units: Unit[] = [
      ...cards.filter((c) => c.blocks.length > 0 || c.h > 80).map((c) => ({ y: c.y, h: c.h, card: c })),
      ...free.map((b) => ({ y: b.y, h: b.h, block: b })),
    ];

    const rows: WebsiteRow[] = rowsOf(units).map((group, i) => {
      const groupCards = group.filter((u) => u.card).map((u) => u.card!);
      if (groupCards.length && groupCards.length >= group.length) {
        return { kind: "grid", id: `${band.layer.id}-r${i}`, cards: groupCards };
      }
      const blocks = group
        .flatMap((u) => (u.block ? [u.block] : u.card ? u.card.blocks : []))
        .sort((a, b) => a.x - b.x);
      return { kind: "blocks", id: `${band.layer.id}-r${i}`, blocks };
    });

    return {
      id: band.layer.id,
      anchor,
      bgColor: band.layer.style.fill,
      bgImage,
      overlayColor,
      overlayOpacity,
      rows,
    };
  };

  const sections: WebsiteSection[] = contentBands.map((band, i) => {
    const anchor = anchorQueue[i] || `section-${i + 1}`;
    return buildSection(band, anchor);
  });

  const footer = footerBand ? buildSection(footerBand, "footer") : undefined;

  const accent =
    navCtaLayer?.style.fill ||
    layers.find((l) => l.type === "button")?.style.fill ||
    "#FF6A3D";

  return {
    designWidth: W,
    contentWidth,
    bgColor: page.background.color || "#070B16",
    accent,
    fontFamily: brandText?.style.fontFamily || "Plus Jakarta Sans",
    brandName: (brandText?.content.text ?? "").trim() || page.name || "",
    logoUrl: logoLayer?.content.src,
    nav: navItems,
    navCta: navCtaLayer
      ? { label: navCtaLayer.content.label ?? "Contact", action: navCtaLayer.action ?? null }
      : undefined,
    sections,
    footer,
  };
}
