import { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import type { WebsiteProfile } from "@/lib/websiteProfile";
import { withWavexPlaceholders, placeholderClients, LOREM_NAME, LOREM_SHORT } from "@/lib/websitePlaceholders";

/**
 * Website page = one long, vertically scrolling page inside the EXISTING editor.
 * It is a normal FlyerPage (same layers, same canvas, same save/undo) marked with
 * `background.websitePage`, so nothing about flyer pages changes.
 *
 * TEMPLATE: WaveX-inspired section hierarchy —
 *   Header → Hero → Intro highlights → Expertise → Team → Statistics →
 *   Portfolio → Featured work → Testimonials → Pricing/Packages →
 *   Clients/Partners → News & Events → Contact → Footer
 *
 * The template supplies the DESIGN. All content comes from the client's own
 * project/dashboard data — nothing is invented; unsupported sections adapt or
 * are skipped.
 *
 * RESPONSIVE: the page is rebuilt (not scaled) for each viewport preset —
 * 1440 desktop / 834 tablet / 430 mobile.
 */

export const WEBSITE_DEVICES = {
  desktop: 1440,
  tablet: 834,
  mobile: 430,
} as const;

export type WebsiteDevice = keyof typeof WEBSITE_DEVICES;

/* WaveX-like palette: clean light sections alternating with full-bleed photo bands. */
const LIGHT = "#FFFFFF";
const LIGHT_2 = "#F2F4F6";
const DARK = "#43494E";
const INK = "#2C3235";
const MUTED = "#8A9299";
const ON_DARK = "#FFFFFF";
const ON_DARK_MUTED = "#D3D8DC";
const ACCENT = "#25C3E6";

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
  cols: number;
  workCols: number;
  teamCols: number;
  statCols: number;
  newsCols: number;
  footerCols: number;
  sectionPad: number;
  btnH: number;
  radius: number;
  stackCta: boolean;
  stackContact: boolean;
  compactNav: boolean;
};

function metricsFor(device: WebsiteDevice): Metrics {
  switch (device) {
    case "mobile":
      return {
        W: 430, PAD: 20, COL: 390, gap: 16,
        navH: 128, heroH: 620, heroFont: 32, eyebrow: 12, h2: 26, h3: 18, body: 15, small: 13,
        cols: 1, workCols: 2, teamCols: 1, statCols: 2, newsCols: 1, footerCols: 1,
        sectionPad: 48, btnH: 52, radius: 6,
        stackCta: true, stackContact: true, compactNav: true,
      };
    case "tablet":
      return {
        W: 834, PAD: 40, COL: 754, gap: 20,
        navH: 84, heroH: 560, heroFont: 44, eyebrow: 13, h2: 32, h3: 19, body: 16, small: 14,
        cols: 2, workCols: 3, teamCols: 2, statCols: 4, newsCols: 2, footerCols: 2,
        sectionPad: 64, btnH: 54, radius: 6,
        stackCta: false, stackContact: true, compactNav: true,
      };
    default:
      return {
        W: 1440, PAD: 120, COL: 1200, gap: 30,
        navH: 84, heroH: 660, heroFont: 62, eyebrow: 14, h2: 40, h3: 20, body: 17, small: 14,
        cols: 3, workCols: 4, teamCols: 2, statCols: 4, newsCols: 2, footerCols: 4,
        sectionPad: 90, btnH: 56, radius: 6,
        stackCta: false, stackContact: false, compactNav: false,
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
      color: opts.color ?? INK,
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
      fill: opts.fill ?? LIGHT,
      cornerRadius: opts.radius ?? 0,
      opacity: opts.opacity ?? 1,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
    },
    content: { shape: "rect" },
  };
}

function circle(pageId: string, x: number, y: number, size: number, fill: string): Layer {
  return {
    ...base(pageId, "shape"),
    position: { x, y },
    size: { width: size, height: size },
    style: { fill, cornerRadius: Math.round(size / 2), opacity: 1 },
    content: { shape: "circle" },
  };
}

function image(pageId: string, src: string, x: number, y: number, width: number, height: number, radius = 0): Layer {
  return {
    ...base(pageId, "image"),
    position: { x, y },
    size: { width, height },
    style: { cornerRadius: radius },
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
      cornerRadius: opts.radius ?? 4,
      fontSize: opts.size ?? 15,
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

type ThemeCopy = {
  introTitle: string;
  expertiseLabel: string;
  expertiseTitle: string;
  teamTitle: string;
  workLabel: string;
  workTitle: string;
  featuredTitle: string;
  pricingTitle: string;
  packagesTitle: string;
  newsTitle: string;
  contactTitle: string;
  primaryCta: string;
};

/** Section wording per business theme/category from the client's dashboard. */
function themeCopy(theme?: string): ThemeCopy {
  const baseCopy: ThemeCopy = {
    introTitle: "What we do",
    expertiseLabel: "Our expertise",
    expertiseTitle: "What we are known for",
    teamTitle: "The people behind the work",
    workLabel: "Our work",
    workTitle: "Recent work",
    featuredTitle: "Featured work",
    pricingTitle: "Our pricing",
    packagesTitle: "Our packages",
    newsTitle: "News & updates",
    contactTitle: "Get in touch",
    primaryCta: "Get in touch",
  };
  switch (theme) {
    case "restaurant":
      return { ...baseCopy, introTitle: "On the menu", expertiseTitle: "What our kitchen does best", workLabel: "Gallery", workTitle: "From our kitchen", featuredTitle: "Chef's feature", pricingTitle: "Menu prices", packagesTitle: "Our menu", primaryCta: "View menu" };
    case "realtor":
      return { ...baseCopy, introTitle: "How we help you move", expertiseTitle: "Where we specialise", workLabel: "Listings", workTitle: "Featured properties", featuredTitle: "Featured listing", pricingTitle: "Listing prices", packagesTitle: "Our services", primaryCta: "Book a viewing" };
    case "beauty":
      return { ...baseCopy, introTitle: "Our treatments", expertiseTitle: "What we specialise in", workTitle: "Recent looks", featuredTitle: "Featured look", pricingTitle: "Price list", packagesTitle: "Treatments", primaryCta: "Book now" };
    case "construction":
      return { ...baseCopy, introTitle: "What we build", expertiseTitle: "Our trades", workLabel: "Projects", workTitle: "Completed projects", featuredTitle: "Featured project", pricingTitle: "Estimates", packagesTitle: "Our services", primaryCta: "Request a quote" };
    case "event":
      return { ...baseCopy, introTitle: "Event highlights", expertiseTitle: "What we deliver", workLabel: "Events", workTitle: "Past events", featuredTitle: "Featured event", pricingTitle: "Packages", packagesTitle: "Event packages", primaryCta: "Reserve your spot" };
    case "fitness":
      return { ...baseCopy, introTitle: "Training programs", expertiseTitle: "How we train", workLabel: "Results", workTitle: "In the gym", featuredTitle: "Featured program", pricingTitle: "Memberships", packagesTitle: "Programs", primaryCta: "Start training" };
    case "retail":
      return { ...baseCopy, introTitle: "Shop our products", expertiseTitle: "What we stock", workLabel: "Lookbook", workTitle: "Featured items", featuredTitle: "Featured product", pricingTitle: "Prices", packagesTitle: "Products", primaryCta: "Shop now" };
    case "personal":
      return { ...baseCopy, introTitle: "What I do", expertiseTitle: "My expertise", teamTitle: "About me", workLabel: "Portfolio", workTitle: "Selected work", featuredTitle: "Featured project", pricingTitle: "Packages", packagesTitle: "Packages", primaryCta: "Work with me" };
    default:
      return baseCopy;
  }
}

/**
 * Builds the WaveX-inspired Website page for the CURRENT client and project at
 * the given viewport.
 */
export function buildWebsitePage(
  flyerId: string,
  index: number,
  rawProfile: WebsiteProfile,
  device: WebsiteDevice = "desktop"
): FlyerPage {
  /* WaveX structure is fixed: missing data becomes an editable Lorem Ipsum
     placeholder layer, never a removed section. */
  const profile = withWavexPlaceholders(rawProfile);
  Z = 0;
  const pageId = uid();
  const M = metricsFor(device);
  const { W, PAD, COL } = M;
  const L: Layer[] = [];
  const add = (...l: Layer[]) => L.push(...l);
  let y = 0;

  const A = profile.brandColors?.accent || ACCENT;
  const T = themeCopy(profile.theme);

  const name = profile.businessName?.trim() || "Your business";
  const images = profile.images ?? [];
  const heroImage = profile.heroImage || images[0];
  const photo = (i: number) => images[i % Math.max(1, images.length)];

  const hasServices = true;
  const galleryImages = Array.from(
    new Set([...(profile.portfolio ?? []).map((p) => p.image).filter(Boolean) as string[], ...images])
  );
  const hasWork = true;
  const hasTeam = true;
  const hasStats = true;
  const hasTestimonials = true;
  const hasPricing = true;
  const hasPackages = true;
  const hasNews = true;
  const hasContact = true;
  const primaryCta = profile.ctas?.[0];
  const secondaryCta = profile.ctas?.[1];

  /** Height a centered section heading will consume (no layers emitted). */
  const measureHead = (eyebrowText: string | undefined, title: string, sub: string | undefined) => {
    let h = eyebrowText ? M.eyebrow * 2 : 0;
    h += textHeight(title, COL, M.h2) + 14;
    if (sub) {
      const subW = Math.min(COL, device === "desktop" ? 720 : COL);
      h += textHeight(sub, subW, M.body);
    }
    return h + 34;
  };

  /** Centered WaveX-style section heading; returns the height it consumed. */
  const heading = (
    yy: number,
    eyebrowText: string | undefined,
    title: string,
    sub: string | undefined,
    onDark: boolean
  ) => {
    let h = 0;
    if (eyebrowText) {
      add(text(pageId, eyebrowText, PAD, yy, COL, { size: M.eyebrow, weight: 700, color: A, align: "center" }));
      h += M.eyebrow * 2;
    }
    const titleH = textHeight(title, COL, M.h2);
    add(text(pageId, title, PAD, yy + h, COL, { size: M.h2, weight: 800, color: onDark ? ON_DARK : INK, align: "center", height: titleH }));
    h += titleH + 14;
    if (sub) {
      const subW = Math.min(COL, device === "desktop" ? 720 : COL);
      const subX = PAD + Math.round((COL - subW) / 2);
      const subH = textHeight(sub, subW, M.body);
      add(text(pageId, sub, subX, yy + h, subW, { size: M.body, color: onDark ? ON_DARK_MUTED : MUTED, align: "center", height: subH }));
      h += subH;
    }
    return h + 34;
  };


  /** Full-bleed photographic band with dark overlay (WaveX signature). */
  const photoBand = (yy: number, h: number, src?: string, fallback = "#2F363B", opacity = 0.72) => {
    add(rect(pageId, 0, yy, W, h, { fill: fallback, radius: 0 }));
    if (src) {
      add(image(pageId, src, 0, yy, W, h, 0));
      add(rect(pageId, 0, yy, W, h, { fill: "#0C1116", radius: 0, opacity }));
    }
  };

  const gridOf = (count: number, cols: number, width = COL, left = PAD) => {
    const c = Math.min(cols, Math.max(1, count));
    const cardW = Math.round((width - M.gap * (c - 1)) / c);
    return { c, cardW, xOf: (i: number) => left + (i % c) * (cardW + M.gap), rowOf: (i: number) => Math.floor(i / c) };
  };

  /* ============================================================ 1. HEADER */
  const navItems: Array<[string, string]> = [["Home", "hero"]];
  navItems.push([T.expertiseLabel.split(" ").pop() || "Expertise", "expertise"]);
  navItems.push(["Team", "team"]);
  navItems.push(["Work", "work"]);
  navItems.push(["Pricing", "pricing"]);
  navItems.push(["News", "news"]);
  navItems.push(["Contact", "contact"]);

  const logoSize = device === "mobile" ? 34 : 40;
  let navH = M.navH;

  if (device === "mobile") {
    const barH = 62;
    const chipW = Math.round((COL - 8 * 2) / 3);
    const chipRows = Math.ceil(navItems.length / 3);
    navH = barH + chipRows * 36 + 12;
    add(rect(pageId, 0, 0, W, navH, { fill: LIGHT, radius: 0 }));
    if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, 14, logoSize, logoSize, 6));
    else add(icon(pageId, "Sparkles", PAD, 16, 28, A));
    add(text(pageId, name, PAD + logoSize + 10, 22, W - PAD * 2 - logoSize - 20, { size: 17, weight: 800, color: INK }));
    navItems.forEach(([label, hash], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const l = text(pageId, label, PAD + col * (chipW + 8), barH + row * 36 + 8, chipW, {
        size: 13, weight: 600, color: MUTED, align: "center",
      });
      l.action = anchor(hash);
      add(l);
    });
  } else {
    const itemW = M.compactNav ? 78 : 100;
    const ctaW = M.compactNav ? 120 : 150;
    const ctaH = 40;
    add(rect(pageId, 0, 0, W, navH, { fill: LIGHT, radius: 0 }));
    if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, (navH - logoSize) / 2, logoSize, logoSize, 6));
    else add(icon(pageId, "Sparkles", PAD, (navH - 36) / 2, 36, A));
    add(text(pageId, name, PAD + logoSize + 12, navH / 2 - 13, device === "tablet" ? 180 : 300, { size: device === "tablet" ? 18 : 22, weight: 800, color: INK }));
    const navRight = hasContact ? W - PAD - ctaW - 16 : W - PAD;
    const navStart = navRight - navItems.length * itemW;
    navItems.forEach(([label, hash], i) => {
      const l = text(pageId, label, navStart + i * itemW, navH / 2 - 9, itemW - 6, {
        size: M.compactNav ? 13 : 14, weight: 600, color: DARK, align: "center",
      });
      l.action = anchor(hash);
      add(l);
    });
    if (hasContact) {
      add(button(pageId, "Contact us", W - PAD - ctaW, (navH - ctaH) / 2, ctaW, ctaH, { fill: A, size: M.compactNav ? 13 : 14, action: anchor("contact") }));
    }
  }
  add(rect(pageId, 0, navH - 1, W, 1, { fill: "#E4E8EB", radius: 0 }));

  /* ============================================================== 2. HERO */
  y = navH;
  const headlineText = profile.headline && profile.headline !== name ? profile.headline : profile.tagline || name;
  const heroSupport = profile.description || (headlineText !== profile.tagline ? profile.tagline : undefined);
  const heroTextW = device === "desktop" ? Math.min(900, COL) : COL;
  const heroTextX = PAD + Math.round((COL - heroTextW) / 2);
  const headlineH = textHeight(headlineText.toUpperCase(), heroTextW, M.heroFont);
  const supportH = heroSupport ? textHeight(heroSupport.slice(0, 220), heroTextW, M.body + 1) : 0;
  const ctaCount = (primaryCta || hasContact ? 1 : 0) + (secondaryCta || profile.whatsapp ? 1 : 0);
  const ctaBlockH = ctaCount === 0 ? 0 : M.stackCta ? ctaCount * (M.btnH + 12) : M.btnH + 12;
  const heroH = Math.max(M.heroH, 140 + headlineH + 22 + supportH + 34 + ctaBlockH + 120);

  photoBand(y, heroH, heroImage, "#3A4247", 0.6);

  let hy = y + Math.round((heroH - (headlineH + supportH + ctaBlockH + 80)) / 2);
  add(text(pageId, name.toUpperCase(), heroTextX, hy, heroTextW, { size: M.eyebrow, weight: 700, color: A, align: "center" }));
  hy += M.eyebrow * 2 + 6;
  add(text(pageId, headlineText.toUpperCase(), heroTextX, hy, heroTextW, { size: M.heroFont, weight: 800, color: ON_DARK, align: "center", height: headlineH }));
  hy += headlineH + 18;
  if (heroSupport) {
    add(text(pageId, heroSupport.slice(0, 220), heroTextX, hy, heroTextW, { size: M.body + 1, color: ON_DARK_MUTED, align: "center", height: supportH }));
    hy += supportH + 30;
  }

  const heroBtnW = M.stackCta ? COL : device === "tablet" ? 190 : 210;
  const heroBtnCount = (primaryCta || hasContact ? 1 : 0) + (secondaryCta || profile.whatsapp ? 1 : 0);
  let bx = M.stackCta ? PAD : PAD + Math.round((COL - (heroBtnCount * heroBtnW + (heroBtnCount - 1) * 20)) / 2);
  let by = hy;
  const placeCta = (l: Layer) => {
    add(l);
    if (M.stackCta) by += M.btnH + 12;
    else bx += heroBtnW + 20;
  };
  if (primaryCta) {
    placeCta(button(pageId, primaryCta.label, bx, by, heroBtnW, M.btnH, { fill: A, action: cloneAction(primaryCta.action) }));
  } else if (hasContact) {
    placeCta(button(pageId, T.primaryCta, bx, by, heroBtnW, M.btnH, { fill: A, action: anchor("contact") }));
  }
  if (secondaryCta) {
    placeCta(button(pageId, secondaryCta.label, M.stackCta ? PAD : bx, by, heroBtnW, M.btnH, {
      fill: "#FFFFFF", color: INK, action: cloneAction(secondaryCta.action),
    }));
  } else if (profile.whatsapp) {
    placeCta(button(pageId, "WhatsApp us", M.stackCta ? PAD : bx, by, heroBtnW, M.btnH, {
      fill: "#25D366", color: "#08240F",
      action: { id: uid(), type: "open_url", payload: { url: profile.whatsapp, newTab: true } },
    }));
  }
  // Scroll indicator
  add(icon(pageId, "ChevronDown", Math.round(W / 2 - 14), y + heroH - 58, 28, ON_DARK));
  y += heroH;

  /* ================================================ 3. INTRO / HIGHLIGHTS */
  const highlights: { title: string; body?: string; image?: string; icon: string }[] = [];
  (profile.services ?? []).slice(0, 4).forEach((s) =>
    highlights.push({ title: s.title, body: s.body, image: s.image, icon: "Sparkles" })
  );
  if (highlights.length < 4) {
    const facts: { title: string; body?: string; icon: string }[] = [];
    if (profile.phone) facts.push({ title: "Call us", body: profile.phone, icon: "Phone" });
    if (profile.whatsapp) facts.push({ title: "WhatsApp", body: "Message us any time", icon: "MessageCircle" });
    if (profile.email) facts.push({ title: "Email", body: profile.email, icon: "Mail" });
    if (profile.address) facts.push({ title: "Visit us", body: profile.address, icon: "MapPin" });
    if (profile.hours?.length) facts.push({ title: "Opening hours", body: profile.hours[0], icon: "Clock" });
    if (profile.offer) facts.push({ title: "Current offer", body: profile.offer, icon: "Tag" });
    facts.forEach((f) => {
      if (highlights.length < 4) highlights.push({ ...f });
    });
  }

  if (highlights.length) {
    const g = gridOf(highlights.length, Math.min(4, device === "mobile" ? 2 : 4));
    const circleSize = device === "mobile" ? 92 : device === "tablet" ? 120 : 150;
    const rows = Math.ceil(highlights.length / g.c);
    const introSub = profile.tagline && profile.tagline !== headlineText ? profile.tagline : profile.description?.slice(0, 180);
    const headH = measureHead(`We are ${name}`, T.introTitle, introSub);
    const itemH = circleSize + 24 + M.h3 + 60;
    const h = M.sectionPad * 2 + headH + rows * itemH + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, `We are ${name}`, T.introTitle, introSub, false);
    const top = y + M.sectionPad + headH;

    highlights.forEach((hl, i) => {
      const cx = g.xOf(i) + Math.round((g.cardW - circleSize) / 2);
      const cy = top + g.rowOf(i) * (itemH + M.gap);
      const tint = i % 2 === 0 ? A : "#6C757B";
      if (hl.image) add(image(pageId, hl.image, cx, cy, circleSize, circleSize, Math.round(circleSize / 2)));
      else {
        add(circle(pageId, cx, cy, circleSize, tint));
        add(icon(pageId, hl.icon, cx + Math.round(circleSize / 2) - 18, cy + Math.round(circleSize / 2) - 18, 36, "#FFFFFF"));
      }
      add(text(pageId, hl.title, g.xOf(i), cy + circleSize + 18, g.cardW, { size: M.h3, weight: 700, color: INK, align: "center" }));
      if (hl.body)
        add(text(pageId, hl.body.slice(0, 120), g.xOf(i), cy + circleSize + 18 + M.h3 + 12, g.cardW, { size: M.small, color: MUTED, align: "center" }));
    });
    y += h;
  }

  /* ========================================================= 4. EXPERTISE */
  const expertiseItems = (hasServices ? profile.services.map((s) => s.title) : [])
    .concat(hasServices ? [] : (profile.ctas ?? []).map((c) => c.label))
    .filter(Boolean)
    .slice(0, 5);
  if (expertiseItems.length) {
    const barH = device === "mobile" ? 34 : 40;
    const expSub = profile.description?.slice(0, 200);
    const headH = measureHead(undefined, T.expertiseTitle, expSub);
    const h = M.sectionPad * 2 + headH + expertiseItems.length * (barH + 18);
    add(rect(pageId, 0, y, W, h, { fill: LIGHT_2, radius: 0 }));
    heading(y + M.sectionPad, undefined, T.expertiseTitle, expSub, false);
    const top = y + M.sectionPad + headH;

    expertiseItems.forEach((label, i) => {
      const width = Math.round(COL * (i % 2 === 0 ? 1 : 0.82));
      add(rect(pageId, PAD, top + i * (barH + 18), width, barH, { fill: i % 2 === 0 ? A : "#6C757B", radius: 3 }));
      add(text(pageId, label, PAD + 18, top + i * (barH + 18) + Math.round(barH / 2) - 9, width - 36, {
        size: M.small + 1, weight: 700, color: "#FFFFFF",
      }));
    });
    y += h;
  }

  /* ============================================================== 5. TEAM */
  if (hasTeam) {
    const g = gridOf(profile.team.length, M.teamCols);
    const avatar = device === "mobile" ? 76 : 92;
    const cardH = Math.max(avatar + 40, 190);
    const rows = Math.ceil(profile.team.length / g.c);
    const headH = measureHead("Our team", T.teamTitle, undefined);
    const h = M.sectionPad * 2 + headH + rows * cardH + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, "Our team", T.teamTitle, undefined, false);
    const top = y + M.sectionPad + headH;

    profile.team.forEach((member, i) => {
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, x, cy, g.cardW, cardH, { fill: LIGHT_2, radius: 4 }));
      if (member.photo) add(image(pageId, member.photo, x + 20, cy + 22, avatar, avatar, Math.round(avatar / 2)));
      else {
        add(circle(pageId, x + 20, cy + 22, avatar, "#C9CFD4"));
        add(icon(pageId, "User", x + 20 + avatar / 2 - 16, cy + 22 + avatar / 2 - 16, 32, "#FFFFFF"));
      }
      const tx = x + 20 + avatar + 18;
      const tw = g.cardW - (20 + avatar + 18) - 20;
      add(text(pageId, member.name, tx, cy + 26, tw, { size: M.h3, weight: 700, color: A }));
      if (member.role) add(text(pageId, member.role, tx, cy + 26 + M.h3 + 8, tw, { size: M.small, weight: 600, color: MUTED }));
      if (member.body)
        add(text(pageId, member.body.slice(0, 150), tx, cy + 26 + M.h3 + 34, tw, { size: M.small, color: DARK }));
    });
    y += h;
  }

  /* ======================================================== 6. STATISTICS */
  if (hasStats) {
    const g = gridOf(profile.stats.length, M.statCols);
    const rows = Math.ceil(profile.stats.length / g.c);
    const rowH = device === "mobile" ? 110 : 130;
    const h = M.sectionPad + rows * rowH + M.sectionPad;
    photoBand(y, h, photo(2) || heroImage, "#3A4247", 0.75);
    const top = y + M.sectionPad;
    profile.stats.forEach((s, i) => {
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * rowH;
      add(text(pageId, s.value, x, cy, g.cardW, { size: device === "mobile" ? 40 : 56, weight: 800, color: ON_DARK, align: "center" }));
      add(text(pageId, s.label.toUpperCase(), x, cy + (device === "mobile" ? 52 : 70), g.cardW, { size: M.small, weight: 700, color: ON_DARK_MUTED, align: "center" }));
    });
    y += h;
  }

  /* ==================================================== 7. WORK/PORTFOLIO */
  if (hasWork) {
    const categories = Array.from(
      new Set((profile.portfolio ?? []).map((p) => p.category).filter(Boolean) as string[])
    ).slice(0, 4);
    const headH = measureHead(T.workLabel, T.workTitle, profile.tagline);
    const filterH = categories.length ? 52 : 0;
    const tileCount = device === "mobile" ? 6 : 8;
    const tiles: Array<string | undefined> = galleryImages.length
      ? galleryImages.slice(0, tileCount)
      : Array.from({ length: device === "mobile" ? 4 : 4 }, () => undefined);
    const g = gridOf(tiles.length, M.workCols, W, 0);
    const tileH = Math.round(g.cardW * 0.82);
    const rows = Math.ceil(tiles.length / g.c);
    const h = M.sectionPad + headH + filterH + rows * tileH;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    // heading + filters
    const headTop = y + M.sectionPad;
    heading(headTop, T.workLabel, T.workTitle, profile.tagline, false);
    if (categories.length) {
      const chipW = Math.min(120, Math.round(COL / (categories.length + 1)));
      const startX = PAD + Math.round((COL - (categories.length + 1) * (chipW + 10)) / 2);
      ["All", ...categories].forEach((c, i) => {
        add(rect(pageId, startX + i * (chipW + 10), headTop + headH, chipW, 36, { fill: i === 0 ? A : LIGHT_2, radius: 3 }));
        add(text(pageId, c, startX + i * (chipW + 10), headTop + headH + 10, chipW, {
          size: M.small, weight: 700, color: i === 0 ? "#FFFFFF" : DARK, align: "center",
        }));
      });
    }
    const gridTop = headTop + headH + filterH;
    tiles.forEach((src, i) => {
      const x = g.xOf(i);
      const cy = gridTop + g.rowOf(i) * tileH;
      if (src) add(image(pageId, src, x, cy, g.cardW, tileH, 0));
      else add(rect(pageId, x, cy, g.cardW, tileH, { fill: "#DCE1E5", radius: 0 }));
      const entry = src
        ? (profile.portfolio ?? []).find((p) => p.image === src) ?? (profile.portfolio ?? [])[i]
        : (profile.portfolio ?? [])[i];
      if (entry?.title) {
        add(rect(pageId, x, cy + tileH - 52, g.cardW, 52, { fill: "#101418", radius: 0, opacity: 0.62 }));
        add(text(pageId, entry.title, x + 14, cy + tileH - 36, g.cardW - 28, { size: M.small + 1, weight: 700, color: ON_DARK }));
      }
    });
    y += h;
  }

  /* ====================================================== 8. FEATURED WORK */
  const featuredImage = galleryImages[1] || galleryImages[0] || heroImage;
  {
    const featured = (profile.portfolio ?? [])[0];
    const featSub = featured?.description ?? profile.tagline;
    const headH = measureHead(undefined, T.featuredTitle, featSub);
    const showW = Math.round(COL * (device === "mobile" ? 1 : 0.82));
    const showH = Math.round(showW * 0.52);
    const frame = 14;
    const h = M.sectionPad * 2 + headH + showH + frame * 2;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT_2, radius: 0 }));
    heading(y + M.sectionPad, undefined, T.featuredTitle, featSub, false);

    const fx = PAD + Math.round((COL - showW) / 2);
    const fy = y + M.sectionPad + headH;
    add(rect(pageId, fx, fy, showW, showH + frame * 2, { fill: "#2C3235", radius: 8 }));
    if (featuredImage) add(image(pageId, featuredImage, fx + frame, fy + frame, showW - frame * 2, showH, 2));
    else {
      add(rect(pageId, fx + frame, fy + frame, showW - frame * 2, showH, { fill: "#DCE1E5", radius: 2 }));
      add(text(pageId, LOREM_SHORT, fx + frame + 20, fy + frame + Math.round(showH / 2) - 10, showW - frame * 2 - 40, { size: M.small + 1, color: MUTED, align: "center" }));
    }
    y += h;
  }

  /* ====================================================== 9. TESTIMONIALS */
  if (hasTestimonials) {
    const t0 = profile.testimonials[0];
    const boxW = Math.round(COL * (device === "mobile" ? 1 : 0.78));
    const quoteH = textHeight(t0.body, boxW - 60, M.body + 1);
    const boxH = 40 + quoteH + 70;
    const h = M.sectionPad * 2 + 80 + boxH;
    photoBand(y, h, photo(3) || heroImage, "#3A4247", 0.72);
    add(text(pageId, "What people say", PAD, y + M.sectionPad, COL, { size: M.h2, weight: 800, color: ON_DARK, align: "center" }));
    const bx0 = PAD + Math.round((COL - boxW) / 2);
    const by0 = y + M.sectionPad + 80;
    add(rect(pageId, bx0, by0, boxW, boxH, { fill: "#FFFFFF", radius: 4, opacity: 0.08, stroke: "#FFFFFF", strokeWidth: 1 }));
    add(text(pageId, `“${t0.body}”`, bx0 + 30, by0 + 26, boxW - 60, { size: M.body + 1, color: ON_DARK, align: "center", italic: true, height: quoteH }));
    if (t0.name)
      add(text(pageId, t0.name, bx0 + 30, by0 + 26 + quoteH + 16, boxW - 60, { size: M.small + 1, weight: 700, color: A, align: "center" }));
    y += h;
  }

  /* =============================================== 10. PRICING / PACKAGES */
  if (hasPackages) {
    const plans = hasPricing
      ? profile.pricing.map((p) => ({ name: p.name, price: p.price, features: p.features }))
      : profile.services.slice(0, 3).map((s) => ({ name: s.title, price: "", features: s.body ? [s.body] : [] }));
    const g = gridOf(plans.length, Math.min(3, M.cols));
    const maxFeatures = Math.max(0, ...plans.map((p) => p.features.length));
    const cardH = 90 + (hasPricing ? 70 : 0) + maxFeatures * 34 + M.btnH + 60;
    const rows = Math.ceil(plans.length / g.c);
    const priceEyebrow = hasPricing ? "Pricing" : "Packages";
    const priceTitle = hasPricing ? T.pricingTitle : T.packagesTitle;
    const headH = measureHead(priceEyebrow, priceTitle, undefined);
    const h = M.sectionPad * 2 + headH + rows * (cardH + 24) + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, priceEyebrow, priceTitle, undefined, false);
    const top = y + M.sectionPad + headH;

    plans.forEach((plan, i) => {
      const featured = plans.length === 3 && i === 1;
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * (cardH + 24 + M.gap) + (featured ? 0 : 24);
      const ch = featured ? cardH + 24 : cardH;
      const innerW = g.cardW - 40;
      add(rect(pageId, x, cy, g.cardW, ch, { fill: featured ? A : "#5B6469", radius: 3 }));
      add(text(pageId, plan.name, x + 20, cy + 24, innerW, { size: M.h3 + 2, weight: 700, color: "#FFFFFF", align: "center" }));
      if (plan.price)
        add(text(pageId, plan.price, x + 20, cy + 24 + M.h3 + 22, innerW, { size: device === "mobile" ? 30 : 38, weight: 800, color: "#FFFFFF", align: "center" }));
      const featTop = cy + 24 + M.h3 + 22 + (plan.price ? 60 : 14);
      plan.features.forEach((f, fi) => {
        add(text(pageId, f, x + 20, featTop + fi * 34, innerW, { size: M.small, color: "#EDF1F3", align: "center" }));
      });
      const cta = primaryCta;
      add(
        button(pageId, cta?.label ?? T.primaryCta, x + 20, cy + ch - 24 - M.btnH, innerW, M.btnH, {
          fill: featured ? "#FFFFFF" : A,
          color: featured ? INK : "#FFFFFF",
          size: M.small + 1,
          action: cta ? cloneAction(cta.action) : anchor("contact"),
        })
      );
    });
    y += h;
  }

  /* ============================================= 11. CLIENTS / PARTNERS */
  {
    const h = M.sectionPad * 2 + 150;
    photoBand(y, h, photo(4) || heroImage, "#3A4247", 0.74);
    add(text(pageId, profile.socials.length ? "Connect with us" : "Our clients", PAD, y + M.sectionPad, COL, { size: M.h2 - 4, weight: 800, color: ON_DARK, align: "center" }));
    const items = profile.socials.length
      ? profile.socials.slice(0, 5)
      : placeholderClients(device === "mobile" ? 3 : 5).map((label) => ({ label, url: "" }));
    const iw = Math.min(150, Math.round(COL / items.length));
    const startX = PAD + Math.round((COL - items.length * iw) / 2);
    items.forEach((s, i) => {
      const l = text(pageId, s.label, startX + i * iw, y + M.sectionPad + 74, iw, {
        size: M.small + 1, weight: 700, color: ON_DARK, align: "center",
      });
      if (s.url) l.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
      add(l);
    });
    y += h;
  }

  /* ======================================================= 12. NEWS/EVENTS */
  if (hasNews) {
    const g = gridOf(profile.news.length, M.newsCols);
    const entryImgH = Math.round(g.cardW * 0.52);
    const entryH = entryImgH + 130;
    const rows = Math.ceil(profile.news.length / g.c);
    const headH = measureHead(undefined, T.newsTitle, undefined);
    const h = M.sectionPad * 2 + headH + rows * entryH + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, undefined, T.newsTitle, undefined, false);
    const top = y + M.sectionPad + headH;

    profile.news.forEach((n, i) => {
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * (entryH + M.gap);
      if (n.image) add(image(pageId, n.image, x, cy, g.cardW, entryImgH, 2));
      else add(rect(pageId, x, cy, g.cardW, entryImgH, { fill: LIGHT_2, radius: 2 }));
      add(text(pageId, n.title, x, cy + entryImgH + 18, g.cardW, { size: M.h3, weight: 700, color: A }));
      if (n.body)
        add(text(pageId, n.body.slice(0, 160), x, cy + entryImgH + 18 + M.h3 + 12, g.cardW, { size: M.small, color: MUTED }));
    });
    y += h;
  }

  /* =========================================================== 13. CONTACT */
  if (hasContact) {
    const infoLines: Array<[string, string]> = [];
    if (profile.phone) infoLines.push(["Phone", profile.phone]);
    if (profile.email) infoLines.push(["Mail", profile.email]);
    if (profile.address) infoLines.push(["MapPin", profile.address]);
    (profile.hours ?? []).slice(0, 2).forEach((line) => infoLines.push(["Clock", line]));

    const formW = Math.round(COL * (device === "mobile" ? 1 : device === "tablet" ? 0.85 : 0.56));
    const formPad = device === "mobile" ? 20 : 30;
    const fieldGap = 14;
    const fieldsH = 50 * 2 + 96 + fieldGap * 2;
    const formH = formPad * 2 + 44 + fieldsH + 16 + M.btnH;
    const infoH = infoLines.length * 40 + 30;
    const h = M.sectionPad * 2 + 90 + formH + infoH;

    photoBand(y, h, photo(5) || heroImage, "#3A4247", 0.76);
    add(text(pageId, T.contactTitle, PAD, y + M.sectionPad, COL, { size: M.h2, weight: 800, color: ON_DARK, align: "center" }));

    const fx = PAD + Math.round((COL - formW) / 2);
    const fy0 = y + M.sectionPad + 90;
    add(rect(pageId, fx, fy0, formW, formH, { fill: "#FFFFFF", radius: 4, opacity: 0.95 }));
    add(text(pageId, `Message ${name}`, fx + formPad, fy0 + formPad, formW - formPad * 2, { size: M.h3, weight: 700, color: INK, align: "center" }));
    let fy = fy0 + formPad + 48;
    ["Your name", "Email address", "Message"].forEach((label, i) => {
      const hh = i === 2 ? 96 : 50;
      add(rect(pageId, fx + formPad, fy, formW - formPad * 2, hh, { fill: LIGHT_2, radius: 3 }));
      add(text(pageId, label, fx + formPad + 14, fy + 16, formW - formPad * 2 - 28, { size: M.small + 1, color: MUTED }));
      fy += hh + fieldGap;
    });
    add(
      button(pageId, "Send message", fx + formPad, fy0 + formH - formPad - M.btnH, formW - formPad * 2, M.btnH, {
        fill: A,
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

    // Contact details + quick actions under the form
    const iy = fy0 + formH + 30;
    const per = Math.round(COL / Math.max(1, infoLines.length));
    infoLines.forEach(([ic, value], i) => {
      const cx = M.stackContact ? PAD : PAD + i * per;
      const cy = M.stackContact ? iy + i * 40 : iy;
      const w = M.stackContact ? COL : per;
      add(icon(pageId, ic, cx + (M.stackContact ? 0 : Math.round(w / 2) - 44), cy, 20, A));
      add(text(pageId, value, cx + (M.stackContact ? 30 : Math.round(w / 2) - 16), cy + 1, M.stackContact ? w - 30 : w - 40, {
        size: M.small + 1, color: ON_DARK,
      }));
    });
    y += h;
  }

  /* ============================================================ 14. FOOTER */
  const footerH = device === "mobile" ? 300 : 260;
  add(rect(pageId, 0, y, W, footerH, { fill: "#2C3235", radius: 0 }));
  const logoS = device === "mobile" ? 44 : 52;
  if (profile.logoUrl) add(image(pageId, profile.logoUrl, Math.round(W / 2 - logoS / 2), y + 40, logoS, logoS, 6));
  else add(icon(pageId, "Sparkles", Math.round(W / 2 - 20), y + 42, 40, A));
  add(text(pageId, name, PAD, y + 40 + logoS + 14, COL, { size: M.h3 + 2, weight: 800, color: ON_DARK, align: "center" }));

  const navRowY = y + 40 + logoS + 14 + M.h3 + 30;
  const navPer = Math.round(COL / Math.max(1, navItems.length));
  navItems.forEach(([label, hash], i) => {
    const l = text(pageId, label, PAD + i * navPer, navRowY, navPer, { size: M.small, weight: 600, color: ON_DARK_MUTED, align: "center" });
    l.action = anchor(hash);
    add(l);
  });

  if (profile.socials.length) {
    const per = Math.round(COL / profile.socials.length);
    profile.socials.slice(0, 6).forEach((s, i) => {
      const l = text(pageId, s.label, PAD + i * per, navRowY + 32, per, { size: M.small, weight: 600, color: A, align: "center" });
      l.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
      add(l);
    });
  }

  const contactLine = [profile.phone, profile.email, profile.address].filter(Boolean).join("  ·  ");
  if (contactLine) {
    add(text(pageId, contactLine, PAD, navRowY + (profile.socials.length ? 68 : 36), COL, { size: M.small, color: ON_DARK_MUTED, align: "center" }));
  }
  add(rect(pageId, PAD, y + footerH - 50, COL, 1, { fill: "#454C51", radius: 0 }));
  add(
    text(pageId, `© ${new Date().getFullYear()} ${name}. All rights reserved.`, PAD, y + footerH - 34, COL, {
      size: 12, color: ON_DARK_MUTED, align: "center",
    })
  );
  y += footerH;

  return {
    id: pageId,
    flyer_id: flyerId,
    index,
    name: "Website",
    background: {
      color: LIGHT,
      size: { width: W, height: Math.round(y) },
      websitePage: true,
      websiteDevice: device,
      websiteProfile: profile,
    },
    layers: L,
  };
}
