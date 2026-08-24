import { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import type { WebsiteProfile } from "@/lib/websiteProfile";

/**
 * Website page = one long, vertically scrolling page inside the EXISTING editor.
 * It is a normal FlyerPage (same layers, same canvas, same save/undo) marked with
 * `background.websitePage`, so nothing about flyer pages changes.
 *
 * RESPONSIVE: the page is rebuilt (not scaled) for each viewport preset —
 * 1440 desktop / 834 tablet / 430 mobile. Every section has its own column
 * counts, container padding, typography scale and stacking rules per device,
 * and the total page height is derived from the content that is generated.
 */

export const WEBSITE_DEVICES = {
  desktop: 1440,
  tablet: 834,
  mobile: 430,
} as const;

export type WebsiteDevice = keyof typeof WEBSITE_DEVICES;

const BG = "#070B16";
const SURFACE = "#101827";
const SURFACE_2 = "#161F32";
const TEXT = "#F8FAFC";
const MUTED = "#94A3B8";
const ACCENT = "#FF6A3D";
const ACCENT_2 = "#3B82F6";

const FONT = "Plus Jakarta Sans";

/* ---------------------------------------------------------------- layout */

type Metrics = {
  W: number;
  PAD: number;
  COL: number;
  gap: number;
  navH: number;
  heroH: number;
  heroFont: number;
  eyebrow: number;
  h2: number;
  h3: number;
  body: number;
  small: number;
  cols: number;        // service / pricing card columns
  workCols: number;    // portfolio columns
  footerCols: number;
  sectionPadTop: number;
  btnH: number;
  radius: number;
  stackCta: boolean;
  stackAbout: boolean;
  stackContact: boolean;
  compactNav: boolean;
};

function metricsFor(device: WebsiteDevice): Metrics {
  switch (device) {
    case "mobile":
      return {
        W: 430, PAD: 20, COL: 390, gap: 16,
        navH: 128, heroH: 720, heroFont: 34, eyebrow: 12, h2: 26, h3: 18, body: 15, small: 13,
        cols: 1, workCols: 1, footerCols: 1, sectionPadTop: 48, btnH: 52, radius: 18,
        stackCta: true, stackAbout: true, stackContact: true, compactNav: true,
      };
    case "tablet":
      return {
        W: 834, PAD: 40, COL: 754, gap: 20,
        navH: 84, heroH: 620, heroFont: 46, eyebrow: 13, h2: 34, h3: 19, body: 16, small: 14,
        cols: 2, workCols: 2, footerCols: 2, sectionPadTop: 64, btnH: 54, radius: 20,
        stackCta: false, stackAbout: true, stackContact: true, compactNav: true,
      };
    default:
      return {
        W: 1440, PAD: 120, COL: 1200, gap: 30,
        navH: 92, heroH: 700, heroFont: 68, eyebrow: 14, h2: 42, h3: 20, body: 17, small: 14,
        cols: 3, workCols: 2, footerCols: 4, sectionPadTop: 80, btnH: 58, radius: 22,
        stackCta: false, stackAbout: false, stackContact: false, compactNav: false,
      };
  }
}

let Z = 0;
const nextZ = () => Z++;

function base(pageId: string, type: Layer["type"]): Layer {
  return {
    id: uid(),
    page_id: pageId,
    type,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    rotation: 0,
    z_index: nextZ(),
    style: {},
    content: {},
    action: null,
  };
}

/** Rough but stable text height so sections can flow instead of overlapping. */
function textHeight(value: string, width: number, size: number) {
  const perLine = Math.max(6, Math.floor(width / (size * 0.54)));
  const explicit = value.split("\n");
  const lines = explicit.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  return Math.round(lines * size * 1.4);
}

function text(
  pageId: string,
  value: string,
  x: number,
  y: number,
  width: number,
  opts: { size?: number; weight?: number; color?: string; align?: "left" | "center" | "right"; height?: number; italic?: boolean } = {}
): Layer {
  const size = opts.size ?? 18;
  return {
    ...base(pageId, "text"),
    position: { x, y },
    size: { width, height: opts.height ?? textHeight(value, width, size) },
    style: {
      fontFamily: FONT,
      fontSize: size,
      fontWeight: opts.weight ?? 400,
      color: opts.color ?? TEXT,
      align: opts.align ?? "left",
      fontStyle: opts.italic ? "italic" : "normal",
    },
    content: { text: value },
  };
}

function rect(
  pageId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { fill?: string; radius?: number; opacity?: number; stroke?: string; strokeWidth?: number } = {}
): Layer {
  return {
    ...base(pageId, "shape"),
    position: { x, y },
    size: { width, height },
    style: {
      fill: opts.fill ?? SURFACE,
      cornerRadius: opts.radius ?? 20,
      opacity: opts.opacity ?? 1,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
    },
    content: { shape: "rect" },
  };
}

function image(pageId: string, src: string, x: number, y: number, width: number, height: number, radius = 20): Layer {
  return {
    ...base(pageId, "image"),
    position: { x, y },
    size: { width, height },
    style: { cornerRadius: radius, objectFit: "cover" },
    content: { src },
  };
}

function icon(pageId: string, name: string, x: number, y: number, size = 44, color = ACCENT): Layer {
  return {
    ...base(pageId, "icon"),
    position: { x, y },
    size: { width: size, height: size },
    style: { color },
    content: { iconName: name },
  };
}

function button(
  pageId: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { fill?: string; color?: string; radius?: number; size?: number; action?: LayerAction | null } = {}
): Layer {
  return {
    ...base(pageId, "button"),
    position: { x, y },
    size: { width, height },
    style: {
      fill: opts.fill ?? ACCENT,
      color: opts.color ?? "#FFFFFF",
      cornerRadius: opts.radius ?? 999,
      fontSize: opts.size ?? 16,
      fontWeight: 700,
      fontFamily: FONT,
      align: "center",
    },
    content: { label },
    action: opts.action ?? null,
  };
}

/** Anchor link to another section of this same page. */
function anchor(hash: string): LayerAction {
  return { id: uid(), type: "open_url", payload: { url: `#${hash}`, newTab: false } };
}

const cloneAction = (a: LayerAction): LayerAction => ({ ...a, id: uid(), payload: { ...a.payload } });

/** Tints a hex colour so brand backgrounds get consistent surface shades. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const dark = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 128;
  const parts = rgb.map((c) => {
    const v = dark ? c + (255 - c) * amount : c * (1 - amount);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${parts.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

type ThemeCopy = {
  aboutLabel: string;
  servicesLabel: string;
  servicesTitle: string;
  workLabel: string;
  workTitle: string;
  pricingTitle: string;
  contactLabel: string;
  primaryCta: string;
};

/** Section wording per business theme/category from the client's dashboard. */
function themeCopy(theme?: string): ThemeCopy {
  const baseCopy: ThemeCopy = {
    aboutLabel: "About",
    servicesLabel: "Services",
    servicesTitle: "What we offer",
    workLabel: "Our work",
    workTitle: "Gallery",
    pricingTitle: "Our prices",
    contactLabel: "Contact",
    primaryCta: "Get in touch",
  };
  switch (theme) {
    case "restaurant":
      return { ...baseCopy, servicesLabel: "Menu", servicesTitle: "On the menu", workLabel: "Gallery", workTitle: "From our kitchen", pricingTitle: "Menu prices", primaryCta: "View menu" };
    case "realtor":
      return { ...baseCopy, servicesTitle: "How we help you move", workLabel: "Listings", workTitle: "Featured properties", pricingTitle: "Listing prices", primaryCta: "Book a viewing" };
    case "beauty":
      return { ...baseCopy, servicesLabel: "Treatments", servicesTitle: "Our treatments", workTitle: "Recent looks", pricingTitle: "Price list", primaryCta: "Book now" };
    case "construction":
      return { ...baseCopy, servicesTitle: "What we build", workLabel: "Projects", workTitle: "Completed projects", pricingTitle: "Estimates", primaryCta: "Request a quote" };
    case "event":
      return { ...baseCopy, servicesLabel: "Packages", servicesTitle: "Event packages", workLabel: "Events", workTitle: "Past events", pricingTitle: "Packages", primaryCta: "Reserve your spot" };
    case "fitness":
      return { ...baseCopy, servicesLabel: "Programs", servicesTitle: "Training programs", workLabel: "Results", workTitle: "In the gym", pricingTitle: "Memberships", primaryCta: "Start training" };
    case "retail":
      return { ...baseCopy, servicesLabel: "Products", servicesTitle: "Shop our products", workLabel: "Lookbook", workTitle: "Featured items", pricingTitle: "Prices", primaryCta: "Shop now" };
    case "personal":
      return { ...baseCopy, servicesTitle: "What I do", workLabel: "Portfolio", workTitle: "Selected work", pricingTitle: "Packages", primaryCta: "Work with me" };
    default:
      return baseCopy;
  }
}

/**
 * Builds the Website page for the CURRENT client and project at the given viewport.
 * Only sections backed by real project data are generated, and the page height is
 * the sum of the sections actually produced for that viewport.
 */
export function buildWebsitePage(
  flyerId: string,
  index: number,
  profile: WebsiteProfile,
  device: WebsiteDevice = "desktop"
): FlyerPage {
  Z = 0;
  const pageId = uid();
  const M = metricsFor(device);
  const { W, PAD, COL } = M;
  const L: Layer[] = [];
  const add = (...l: Layer[]) => L.push(...l);
  let y = 0;

  /* Brand colours from the client's project (business card) fall back to template. */
  const A = profile.brandColors?.accent || ACCENT;
  const PBG = profile.brandColors?.background || BG;
  const S1 = profile.brandColors?.background ? shade(PBG, 0.12) : SURFACE;
  const S2 = profile.brandColors?.background ? shade(PBG, 0.2) : SURFACE_2;

  const T = themeCopy(profile.theme);

  const name = profile.businessName?.trim() || "Your business";
  const images = profile.images ?? [];
  const heroImage = profile.heroImage || images[0];
  const hasAbout = !!profile.description;
  const hasServices = (profile.services?.length ?? 0) > 0;
  const hasPortfolio = (profile.portfolio?.length ?? 0) > 0;
  const hasPricing = (profile.pricing?.length ?? 0) > 0;
  const hasContact = !!(profile.phone || profile.email || profile.address || profile.whatsapp || profile.hours?.length);
  const primaryCta = profile.ctas?.[0];
  const secondaryCta = profile.ctas?.[1];

  const eyebrow = (label: string, x: number, yy: number, width: number, align: "left" | "center" = "left") =>
    text(pageId, label.toUpperCase(), x, yy, width, { size: M.eyebrow, weight: 700, color: A, align });

  /** Column geometry for a responsive card grid. */
  const grid = (count: number, cols: number) => {
    const c = Math.min(cols, Math.max(1, count));
    const cardW = Math.round((COL - M.gap * (c - 1)) / c);
    return { c, cardW, xOf: (i: number) => PAD + (i % c) * (cardW + M.gap), rowOf: (i: number) => Math.floor(i / c) };
  };

  /* ---------------- Navigation ---------------- */
  const navItems: Array<[string, string]> = [["Home", "hero"]];
  if (hasAbout) navItems.push(["About", "about"]);
  if (hasServices) navItems.push(["Services", "services"]);
  if (hasPortfolio) navItems.push(["Work", "work"]);
  if (hasPricing) navItems.push(["Pricing", "pricing"]);
  if (hasContact) navItems.push(["Contact", "contact"]);

  const logoSize = device === "mobile" ? 36 : device === "tablet" ? 42 : 48;
  let navH = M.navH;

  if (device === "mobile") {
    // Compact mobile bar: brand + menu button, with wrapped anchor chips underneath.
    const barH = 64;
    const chipW = Math.round((COL - 8 * 2) / 3);
    const chipRows = Math.ceil(navItems.length / 3);
    navH = barH + chipRows * 38 + 12;
    add(rect(pageId, 0, 0, W, navH, { fill: S1, radius: 0, opacity: 0.98 }));
    if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, 14, logoSize, logoSize, 10));
    else add(icon(pageId, "Sparkles", PAD, 16, 30, A));
    add(text(pageId, name, PAD + logoSize + 10, 24, W - PAD * 2 - logoSize - 90, { size: 17, weight: 800 }));
    add(
      button(pageId, "Menu", W - PAD - 74, 16, 74, 36, {
        fill: A,
        size: 13,
        radius: 12,
        action: anchor(navItems[navItems.length - 1]?.[1] ?? "hero"),
      })
    );
    navItems.forEach(([label, hash], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const l = text(pageId, label, PAD + col * (chipW + 8), barH + row * 38 + 8, chipW, {
        size: 13,
        weight: 600,
        color: MUTED,
        align: "center",
      });
      l.action = anchor(hash);
      add(l);
    });
  } else {
    const itemW = M.compactNav ? 74 : 96;
    const ctaW = M.compactNav ? 120 : 150;
    const ctaH = M.compactNav ? 38 : 42;
    add(rect(pageId, 0, 0, W, navH, { fill: S1, radius: 0, opacity: 0.95 }));
    if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, (navH - logoSize) / 2, logoSize, logoSize, 12));
    else add(icon(pageId, "Sparkles", PAD, (navH - 40) / 2, 40, A));
    add(text(pageId, name, PAD + logoSize + 12, navH / 2 - 14, device === "tablet" ? 200 : 320, { size: device === "tablet" ? 18 : 22, weight: 800 }));
    const navRight = hasContact ? W - PAD - ctaW - 16 : W - PAD;
    const navStart = navRight - navItems.length * itemW;
    navItems.forEach(([label, hash], i) => {
      const l = text(pageId, label, navStart + i * itemW, navH / 2 - 10, itemW - 6, {
        size: M.compactNav ? 13 : 15,
        weight: 600,
        color: MUTED,
        align: "center",
      });
      l.action = anchor(hash);
      add(l);
    });
    if (hasContact) {
      add(button(pageId, "Contact us", W - PAD - ctaW, (navH - ctaH) / 2, ctaW, ctaH, { size: M.compactNav ? 13 : 16, action: anchor("contact") }));
    }
  }

  /* ---------------- Hero ---------------- */
  y = navH;
  const heroTop = device === "mobile" ? 56 : device === "tablet" ? 90 : 140;
  const headlineText = profile.headline && profile.headline !== name ? profile.headline : profile.tagline || name;
  const heroSupport = profile.description || (headlineText !== profile.tagline ? profile.tagline : undefined);
  const heroTextW = device === "desktop" ? Math.min(820, COL) : COL;

  const headlineH = textHeight(headlineText, heroTextW, M.heroFont);
  const supportH = heroSupport ? textHeight(heroSupport.slice(0, 220), Math.min(heroTextW, device === "desktop" ? 660 : COL), M.body + 2) : 0;
  const ctaCount = (primaryCta || hasContact ? 1 : 0) + (secondaryCta || profile.whatsapp ? 1 : 0);
  const ctaBlockH = ctaCount === 0 ? 0 : M.stackCta ? ctaCount * (M.btnH + 12) : M.btnH + 12;
  const offerH = profile.offer ? 60 : 0;
  const heroH = Math.max(
    device === "mobile" ? 560 : M.heroH,
    heroTop + M.eyebrow * 2 + headlineH + 24 + supportH + 24 + offerH + ctaBlockH + (device === "mobile" ? 56 : 90)
  );

  add(rect(pageId, 0, y, W, heroH, { fill: PBG, radius: 0 }));
  if (heroImage) {
    add(image(pageId, heroImage, 0, y, W, heroH, 0));
    add(rect(pageId, 0, y, W, heroH, { fill: "#050912", radius: 0, opacity: 0.7 }));
  }

  let hy = y + heroTop;
  add(eyebrow(name, PAD, hy, heroTextW));
  hy += M.eyebrow * 2;
  add(text(pageId, headlineText, PAD, hy, heroTextW, { size: M.heroFont, weight: 800, height: headlineH }));
  hy += headlineH + 20;
  if (heroSupport) {
    const w = Math.min(heroTextW, device === "desktop" ? 660 : COL);
    add(text(pageId, heroSupport.slice(0, 220), PAD, hy, w, { size: M.body + 2, color: MUTED, height: supportH }));
    hy += supportH + 24;
  }
  if (profile.offer) {
    const badgeW = Math.min(COL, profile.offer.length * (M.body * 0.62) + 48);
    add(rect(pageId, PAD, hy, badgeW, 44, { fill: A, radius: 999 }));
    add(text(pageId, profile.offer, PAD + 20, hy + 12, badgeW - 40, { size: M.body - 1, weight: 700, color: "#FFFFFF" }));
    hy += offerH;
  }

  const ctaW = M.stackCta ? COL : device === "tablet" ? 200 : 230;
  let bx = PAD;
  let by = hy;
  const placeCta = (l: Layer) => {
    add(l);
    if (M.stackCta) by += M.btnH + 12;
    else bx += ctaW + 20;
  };
  if (primaryCta) {
    placeCta(button(pageId, primaryCta.label, bx, by, ctaW, M.btnH, { fill: A, action: cloneAction(primaryCta.action) }));
  } else if (hasContact) {
    placeCta(button(pageId, T.primaryCta, bx, by, ctaW, M.btnH, { fill: A, action: anchor("contact") }));
  }
  if (secondaryCta) {
    placeCta(
      button(pageId, secondaryCta.label, M.stackCta ? PAD : bx, by, ctaW, M.btnH, {
        fill: "#FFFFFF",
        color: "#0B1220",
        action: cloneAction(secondaryCta.action),
      })
    );
  } else if (profile.whatsapp) {
    placeCta(
      button(pageId, "WhatsApp us", M.stackCta ? PAD : bx, by, ctaW, M.btnH, {
        fill: "#25D366",
        color: "#08240F",
        action: { id: uid(), type: "open_url", payload: { url: profile.whatsapp, newTab: true } },
      })
    );
  }
  y += heroH;

  /* ---------------- About ---------------- */
  if (hasAbout) {
    const aboutImg = images[1] || images[0];
    const stacked = M.stackAbout;
    const imgW = stacked ? COL : Math.round(COL * 0.45);
    const imgH = Math.round(imgW * (stacked ? 0.6 : 0.74));
    const txtW = stacked ? COL : COL - imgW - M.gap * 2;
    const titleStr = `About ${name}`;
    const titleH = textHeight(titleStr, txtW, M.h2);
    const bodyH = textHeight(profile.description!, txtW, M.body);
    const textBlockH = M.eyebrow * 2 + titleH + 16 + bodyH;
    const contentH = stacked ? (aboutImg ? imgH + 28 : 0) + textBlockH : Math.max(aboutImg ? imgH : 0, textBlockH);
    const h = M.sectionPadTop * 2 + contentH;

    add(rect(pageId, 0, y, W, h, { fill: PBG, radius: 0 }));
    let ay = y + M.sectionPadTop;
    if (aboutImg) {
      add(image(pageId, aboutImg, PAD, ay, imgW, imgH, M.radius + 6));
      if (stacked) ay += imgH + 28;
    }
    const tx = stacked || !aboutImg ? PAD : PAD + imgW + M.gap * 2;
    add(eyebrow(T.aboutLabel, tx, ay, txtW));
    add(text(pageId, titleStr, tx, ay + M.eyebrow * 2, txtW, { size: M.h2, weight: 800, height: titleH }));
    add(text(pageId, profile.description!, tx, ay + M.eyebrow * 2 + titleH + 16, txtW, { size: M.body, color: MUTED, height: bodyH }));
    y += h;
  }

  /* ---------------- Services ---------------- */
  if (hasServices) {
    const g = grid(profile.services.length, M.cols);
    const cardPad = device === "mobile" ? 20 : 28;
    const cardH = device === "mobile" ? 170 : 200;
    const rows = Math.ceil(profile.services.length / g.c);
    const headH = M.eyebrow * 2 + textHeight(T.servicesTitle, COL, M.h2) + 28;
    const h = M.sectionPadTop * 2 + headH + rows * cardH + (rows - 1) * M.gap;

    add(rect(pageId, 0, y, W, h, { fill: S1, radius: 0 }));
    add(eyebrow(T.servicesLabel, PAD, y + M.sectionPadTop, COL, "center"));
    add(text(pageId, T.servicesTitle, PAD, y + M.sectionPadTop + M.eyebrow * 2, COL, { size: M.h2, weight: 800, align: "center" }));
    const gridTop = y + M.sectionPadTop + headH;
    profile.services.forEach((s, i) => {
      const x = g.xOf(i);
      const cy = gridTop + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, x, cy, g.cardW, cardH, { fill: S2, radius: M.radius }));
      if (s.image) add(image(pageId, s.image, x + cardPad, cy + cardPad, 52, 52, 14));
      else add(icon(pageId, "Sparkles", x + cardPad, cy + cardPad, 38, A));
      add(text(pageId, s.title, x + cardPad, cy + cardPad + 62, g.cardW - cardPad * 2, { size: M.h3, weight: 700 }));
      if (s.body)
        add(text(pageId, s.body.slice(0, device === "mobile" ? 100 : 140), x + cardPad, cy + cardPad + 92, g.cardW - cardPad * 2, { size: M.small, color: MUTED }));
    });
    y += h;
  }

  /* ---------------- Work / gallery ---------------- */
  if (hasPortfolio) {
    const g = grid(profile.portfolio.length, M.workCols);
    const imgH = Math.round(g.cardW * 0.58);
    const cardH = imgH + 120;
    const rows = Math.ceil(profile.portfolio.length / g.c);
    const headH = M.eyebrow * 2 + textHeight(T.workTitle, COL, M.h2) + 28;
    const h = M.sectionPadTop * 2 + headH + rows * cardH + (rows - 1) * M.gap;

    add(rect(pageId, 0, y, W, h, { fill: PBG, radius: 0 }));
    add(eyebrow(T.workLabel, PAD, y + M.sectionPadTop, COL, "center"));
    add(text(pageId, T.workTitle, PAD, y + M.sectionPadTop + M.eyebrow * 2, COL, { size: M.h2, weight: 800, align: "center" }));
    const gridTop = y + M.sectionPadTop + headH;
    profile.portfolio.forEach((p, i) => {
      const x = g.xOf(i);
      const cy = gridTop + g.rowOf(i) * (cardH + M.gap);
      if (p.image) add(image(pageId, p.image, x, cy, g.cardW, imgH, M.radius));
      else add(rect(pageId, x, cy, g.cardW, imgH, { fill: S2, radius: M.radius }));
      if (p.category) add(text(pageId, p.category.toUpperCase(), x, cy + imgH + 14, g.cardW, { size: 12, weight: 700, color: A }));
      add(text(pageId, p.title, x, cy + imgH + 34, g.cardW, { size: M.h3, weight: 700 }));
      if (p.description)
        add(text(pageId, p.description.slice(0, device === "mobile" ? 110 : 160), x, cy + imgH + 62, g.cardW, { size: M.small, color: MUTED }));
    });
    y += h;
  }

  /* ---------------- Pricing ---------------- */
  if (hasPricing) {
    const g = grid(profile.pricing.length, M.cols);
    const cardPad = device === "mobile" ? 20 : 28;
    const maxFeatures = Math.max(0, ...profile.pricing.map((p) => p.features.length));
    const cardH = cardPad * 2 + 120 + maxFeatures * 30 + (primaryCta ? M.btnH + 16 : 0);
    const rows = Math.ceil(profile.pricing.length / g.c);
    const headH = M.eyebrow * 2 + textHeight(T.pricingTitle, COL, M.h2) + 28;
    const h = M.sectionPadTop * 2 + headH + rows * cardH + (rows - 1) * M.gap;

    add(rect(pageId, 0, y, W, h, { fill: S1, radius: 0 }));
    add(eyebrow("Pricing", PAD, y + M.sectionPadTop, COL, "center"));
    add(text(pageId, T.pricingTitle, PAD, y + M.sectionPadTop + M.eyebrow * 2, COL, { size: M.h2, weight: 800, align: "center" }));
    const gridTop = y + M.sectionPadTop + headH;
    profile.pricing.forEach((plan, i) => {
      const x = g.xOf(i);
      const cy = gridTop + g.rowOf(i) * (cardH + M.gap);
      const innerW = g.cardW - cardPad * 2;
      add(rect(pageId, x, cy, g.cardW, cardH, { fill: S2, radius: M.radius + 2 }));
      add(text(pageId, plan.name, x + cardPad, cy + cardPad, innerW, { size: M.h3, weight: 700, color: "#FFFFFF" }));
      add(text(pageId, plan.price, x + cardPad, cy + cardPad + 34, innerW, { size: device === "mobile" ? 28 : 36, weight: 800, color: A }));
      plan.features.forEach((f, fi) => {
        add(text(pageId, `•  ${f}`, x + cardPad, cy + cardPad + 110 + fi * 30, innerW, { size: M.small + 1, color: MUTED }));
      });
      if (primaryCta) {
        add(
          button(pageId, primaryCta.label, x + cardPad, cy + cardH - cardPad - M.btnH, innerW, M.btnH, {
            fill: A,
            size: M.small + 1,
            action: cloneAction(primaryCta.action),
          })
        );
      }
    });
    y += h;
  }

  /* ---------------- Contact ---------------- */
  if (hasContact) {
    const rows: Array<[string, string]> = [];
    if (profile.phone) rows.push(["Phone", profile.phone]);
    if (profile.whatsapp) rows.push(["MessageCircle", "WhatsApp"]);
    if (profile.email) rows.push(["Mail", profile.email]);
    if (profile.address) rows.push(["MapPin", profile.address]);
    (profile.hours ?? []).forEach((line) => rows.push(["Clock", line]));

    const stacked = M.stackContact;
    const infoW = stacked ? COL : Math.round(COL * 0.45);
    const formW = stacked ? COL : COL - infoW - M.gap * 2;
    const titleStr = `Get in touch with ${name}`;
    const titleH = textHeight(titleStr, infoW, M.h2 - 2);

    // Contact CTA buttons: stack on mobile, wrap in pairs otherwise.
    const ctaLabels: Array<{ label: string; fill: string; color?: string; action: LayerAction }> = [];
    if (profile.phone) ctaLabels.push({ label: "Call us", fill: A, action: { id: uid(), type: "call", payload: { phone: profile.phone } } });
    if (profile.whatsapp)
      ctaLabels.push({ label: "WhatsApp", fill: "#25D366", color: "#08240F", action: { id: uid(), type: "open_url", payload: { url: profile.whatsapp, newTab: true } } });
    if (profile.email)
      ctaLabels.push({ label: "Email us", fill: S2, action: { id: uid(), type: "open_url", payload: { url: `mailto:${profile.email}`, newTab: false } } });
    if (profile.address)
      ctaLabels.push({ label: "Get directions", fill: ACCENT_2, action: { id: uid(), type: "map", payload: { mapAddress: profile.address, mapProvider: "auto" } } });

    const btnCols = device === "mobile" ? 1 : 2;
    const btnW = Math.round((infoW - M.gap * (btnCols - 1)) / btnCols);
    const btnRows = Math.ceil(ctaLabels.length / btnCols);
    const infoH = M.eyebrow * 2 + titleH + 30 + rows.length * 46 + 24 + btnRows * (M.btnH + 12);

    const fieldGap = 16;
    const fieldsH = 52 * 2 + 96 + fieldGap * 2;
    const formInnerPad = device === "mobile" ? 20 : 32;
    const formH = formInnerPad * 2 + 40 + fieldsH + 16 + M.btnH;

    const h = M.sectionPadTop * 2 + (stacked ? infoH + 36 + formH : Math.max(infoH, formH));
    add(rect(pageId, 0, y, W, h, { fill: PBG, radius: 0 }));

    let iy = y + M.sectionPadTop;
    add(eyebrow(T.contactLabel, PAD, iy, infoW));
    add(text(pageId, titleStr, PAD, iy + M.eyebrow * 2, infoW, { size: M.h2 - 2, weight: 800, height: titleH }));
    let ry = iy + M.eyebrow * 2 + titleH + 30;
    rows.forEach(([ic, value]) => {
      add(icon(pageId, ic, PAD, ry, 22, A));
      add(text(pageId, value, PAD + 36, ry + 2, infoW - 36, { size: M.body - 1 }));
      ry += 46;
    });
    ry += 24;
    ctaLabels.forEach((c, i) => {
      const col = i % btnCols;
      const row = Math.floor(i / btnCols);
      add(
        button(pageId, c.label, PAD + col * (btnW + M.gap), ry + row * (M.btnH + 12), btnW, M.btnH, {
          fill: c.fill,
          color: c.color,
          size: M.small + 1,
          action: c.action,
        })
      );
    });

    // Message form — collects leads into the existing form submissions flow
    const fx = stacked ? PAD : PAD + infoW + M.gap * 2;
    const fy0 = stacked ? y + M.sectionPadTop + infoH + 36 : y + M.sectionPadTop;
    add(rect(pageId, fx, fy0, formW, formH, { fill: S1, radius: M.radius + 4 }));
    add(text(pageId, "Send us a message", fx + formInnerPad, fy0 + formInnerPad, formW - formInnerPad * 2, { size: M.h3 + 2, weight: 700 }));
    let fy = fy0 + formInnerPad + 46;
    ["Your name", "Email address", "Message"].forEach((label, i) => {
      const hh = i === 2 ? 96 : 52;
      add(rect(pageId, fx + formInnerPad, fy, formW - formInnerPad * 2, hh, { fill: S2, radius: 12 }));
      add(text(pageId, label, fx + formInnerPad + 16, fy + 17, formW - formInnerPad * 2 - 32, { size: M.small + 1, color: MUTED }));
      fy += hh + fieldGap;
    });
    add(
      button(pageId, "Send message", fx + formInnerPad, fy0 + formH - formInnerPad - M.btnH, formW - formInnerPad * 2, M.btnH, {
        fill: A,
        radius: 14,
        size: M.small + 2,
        action: {
          id: uid(),
          type: "form",
          payload: {
            title: `Contact ${name}`,
            fields: ["name", "email", "phone"],
            successMessage: "Thanks — we'll be in touch.",
          },
        },
      })
    );
    y += h;
  }

  /* ---------------- Footer ---------------- */
  const contactLines = [profile.phone, profile.email, profile.address].filter(Boolean) as string[];
  const footerCols: Array<{ title: string; items: Array<{ label: string; action?: LayerAction }> }> = [];
  footerCols.push({ title: "Navigate", items: navItems.map(([label, hash]) => ({ label, action: anchor(hash) })) });
  if (contactLines.length) footerCols.push({ title: "Contact", items: contactLines.map((l) => ({ label: l })) });
  if (profile.socials.length)
    footerCols.push({
      title: "Follow",
      items: profile.socials.slice(0, 4).map((s) => ({ label: s.label, action: { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } } as LayerAction })),
    });

  const brandBlockH = 60 + (profile.description ? textHeight(profile.description.slice(0, 140), Math.min(COL, 380), M.small) + 12 : 0);
  const fCols = Math.max(1, Math.min(M.footerCols - (device === "desktop" ? 1 : 0), footerCols.length));
  const colW = Math.round((COL - M.gap * (fCols - 1)) / fCols);
  const colRows = Math.ceil(footerCols.length / fCols);
  const tallestCol = Math.max(...footerCols.map((c) => 34 + c.items.length * 28), 0);

  let footerBodyH: number;
  if (device === "desktop") {
    footerBodyH = Math.max(brandBlockH, tallestCol);
  } else {
    footerBodyH = brandBlockH + 28 + colRows * (tallestCol + 24);
  }
  const footerH = 48 + footerBodyH + 70;

  add(rect(pageId, 0, y, W, footerH, { fill: S1, radius: 0 }));
  const logoS = device === "mobile" ? 36 : 44;
  if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, y + 48, logoS, logoS, 10));
  else add(icon(pageId, "Sparkles", PAD, y + 50, logoS - 8, A));
  add(text(pageId, name, PAD + logoS + 12, y + 56, Math.min(300, COL - logoS - 12), { size: M.h3, weight: 800 }));
  if (profile.description) {
    add(text(pageId, profile.description.slice(0, 140), PAD, y + 48 + 62, Math.min(COL, device === "desktop" ? 380 : COL), { size: M.small, color: MUTED }));
  }

  const colsTop = device === "desktop" ? y + 48 : y + 48 + brandBlockH + 28;
  const colsLeft = device === "desktop" ? PAD + Math.round(COL * 0.36) : PAD;
  const colsAvail = device === "desktop" ? COL - Math.round(COL * 0.36) : COL;
  const dColW = Math.round((colsAvail - M.gap * (fCols - 1)) / fCols);
  footerCols.forEach((col, i) => {
    const cx = colsLeft + (i % fCols) * ((device === "desktop" ? dColW : colW) + M.gap);
    const cy = colsTop + Math.floor(i / fCols) * (tallestCol + 24);
    const cw = device === "desktop" ? dColW : colW;
    add(text(pageId, col.title, cx, cy, cw, { size: M.small + 1, weight: 700 }));
    col.items.forEach((item, ii) => {
      const l = text(pageId, item.label, cx, cy + 30 + ii * 28, cw, { size: M.small, color: MUTED });
      if (item.action) l.action = item.action;
      add(l);
    });
  });

  add(rect(pageId, PAD, y + footerH - 52, COL, 1, { fill: "#243049", radius: 0 }));
  add(
    text(pageId, `© ${new Date().getFullYear()} ${name}. All rights reserved.`, PAD, y + footerH - 34, COL, {
      size: 13,
      color: MUTED,
      align: "center",
    })
  );
  y += footerH;

  return {
    id: pageId,
    flyer_id: flyerId,
    index,
    name: "Website",
    background: {
      color: PBG,
      size: { width: W, height: Math.round(y) },
      websitePage: true,
      websiteDevice: device,
      websiteProfile: profile,
    },
    layers: L,
  };
}
