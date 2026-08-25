import { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import { DEFAULT_WEBSITE_SECTIONS, type WebsiteProfile, type WebsiteSectionKey } from "@/lib/websiteProfile";
import websitePlaceholderImg from "@/assets/website-placeholder.jpg";
import { withWavexPlaceholders, placeholderClients, LOREM_SHORT, LOREM_NAME, LOREM_LONG } from "@/lib/websitePlaceholders";

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
    /* cover = crop to the box, never stretch the client's photo */
    style: { cornerRadius: radius, fit: "cover" },
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
  const profile = { ...withWavexPlaceholders(rawProfile), sections: rawProfile.sections ?? DEFAULT_WEBSITE_SECTIONS };
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

  /* Only the sections the client picked are built (header, hero and footer always render). */
  const picked = rawProfile.sections ?? DEFAULT_WEBSITE_SECTIONS;
  const on = (k: WebsiteSectionKey) => picked.includes(k);

  const hasServices = on("intro");
  const galleryImages = Array.from(
    new Set([...(profile.portfolio ?? []).map((p) => p.image).filter(Boolean) as string[], ...images])
  );
  const hasIntro = on("intro");
  const hasExpertise = on("expertise");
  const hasFeatured = on("featured");
  const hasClients = on("clients");
  const hasWork = on("work");
  const hasTeam = on("team");
  const hasStats = on("stats");
  const hasTestimonials = on("testimonials");
  const hasPricing = on("pricing");
  const hasPackages = on("pricing");
  const hasNews = on("news");
  const hasContact = on("contact");
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
  if (hasExpertise) navItems.push([T.expertiseLabel.split(" ").pop() || "Expertise", "expertise"]);
  if (hasTeam) navItems.push(["Team", "team"]);
  if (hasWork) navItems.push(["Work", "work"]);
  if (hasPricing) navItems.push(["Pricing", "pricing"]);
  if (hasNews) navItems.push(["News", "news"]);
  if (hasContact) navItems.push(["Contact", "contact"]);

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
  const heroTextW = device === "desktop" ? Math.min(1040, COL) : COL;
  const heroTextX = PAD + Math.round((COL - heroTextW) / 2);
  const headlineH = textHeight(headlineText.toUpperCase(), heroTextW, M.heroFont);
  const supportH = heroSupport ? textHeight(heroSupport.slice(0, 220), heroTextW, M.body + 1) : 0;
  const ctaCount = (primaryCta || hasContact ? 1 : 0) + (secondaryCta || profile.whatsapp ? 1 : 0);
  const ctaBlockH = ctaCount === 0 ? 0 : M.stackCta ? ctaCount * (M.btnH + 12) : M.btnH + 12;
  const heroH = Math.max(
    device === "mobile" ? 660 : device === "tablet" ? 640 : 780,
    160 + headlineH + 26 + supportH + 44 + ctaBlockH + 140
  );

  /* Full-bleed client visual + WaveX dark wash (two stacked overlays so the
     bottom of the hero reads darker, like the reference). */
  photoBand(y, heroH, heroImage, "#3A4247", 0.58);
  add(rect(pageId, 0, y + Math.round(heroH * 0.45), W, Math.round(heroH * 0.55), { fill: "#0C1116", radius: 0, opacity: 0.28 }));

  let hy = y + Math.round((heroH - (headlineH + supportH + ctaBlockH + 120)) / 2);
  add(text(pageId, name.toUpperCase(), heroTextX, hy, heroTextW, { size: M.eyebrow, weight: 700, color: A, align: "center" }));
  hy += M.eyebrow * 2 + 4;
  /* thin accent rule under the eyebrow (WaveX detail) */
  add(rect(pageId, Math.round(W / 2 - 26), hy, 52, 3, { fill: A, radius: 2 }));
  hy += 22;
  add(text(pageId, headlineText.toUpperCase(), heroTextX, hy, heroTextW, { size: M.heroFont, weight: 800, color: ON_DARK, align: "center", height: headlineH }));
  hy += headlineH + 22;
  if (heroSupport) {
    const supW = device === "desktop" ? Math.min(760, heroTextW) : heroTextW;
    const supX = PAD + Math.round((COL - supW) / 2);
    add(text(pageId, heroSupport.slice(0, 220), supX, hy, supW, { size: M.body + 1, color: ON_DARK_MUTED, align: "center", height: supportH }));
    hy += supportH + 40;
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
  add(icon(pageId, "ChevronDown", Math.round(W / 2 - 14), y + heroH - 62, 28, ON_DARK));
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

  if (hasIntro && highlights.length) {
    const g = gridOf(highlights.length, Math.min(4, device === "mobile" ? 2 : 4));
    const circleSize = device === "mobile" ? 96 : device === "tablet" ? 124 : 148;
    const rows = Math.ceil(highlights.length / g.c);
    const introSub = profile.tagline && profile.tagline !== headlineText ? profile.tagline : profile.description?.slice(0, 180);
    const headH = measureHead(`We are ${name}`, T.introTitle, introSub);
    const bodyH = textHeight(LOREM_SHORT, g.cardW, M.small);
    const itemH = circleSize + 26 + M.h3 + 12 + bodyH + 14;
    const h = M.sectionPad * 2 + headH + rows * itemH + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, `We are ${name}`, T.introTitle, introSub, false);
    const top = y + M.sectionPad + headH;

    highlights.forEach((hl, i) => {
      const cx = g.xOf(i) + Math.round((g.cardW - circleSize) / 2);
      const cy = top + g.rowOf(i) * (itemH + M.gap);
      if (hl.image) {
        add(circle(pageId, cx - 6, cy - 6, circleSize + 12, "#EDF1F3"));
        add(image(pageId, hl.image, cx, cy, circleSize, circleSize, Math.round(circleSize / 2)));
      } else {
        /* soft ring + solid accent disc, WaveX icon treatment */
        add(circle(pageId, cx - 8, cy - 8, circleSize + 16, i % 2 === 0 ? "#E6F7FC" : "#EDF1F3"));
        add(circle(pageId, cx, cy, circleSize, i % 2 === 0 ? A : "#6C757B"));
        add(icon(pageId, hl.icon, cx + Math.round(circleSize / 2) - 20, cy + Math.round(circleSize / 2) - 20, 40, "#FFFFFF"));
      }
      add(text(pageId, hl.title, g.xOf(i), cy + circleSize + 22, g.cardW, { size: M.h3, weight: 700, color: INK, align: "center" }));
      add(
        text(pageId, (hl.body ?? LOREM_SHORT).slice(0, 130), g.xOf(i), cy + circleSize + 22 + M.h3 + 12, g.cardW, {
          size: M.small, color: MUTED, align: "center", height: bodyH,
        })
      );
    });
    y += h;
  }

  /* ========================================================= 4. EXPERTISE */
  const expertiseItems = (profile.services ?? []).map((s) => s.title).filter(Boolean).slice(0, 5);
  if (hasExpertise && expertiseItems.length) {
    const barW = Math.round(COL * (device === "desktop" ? 0.78 : 1));
    const barX = PAD + Math.round((COL - barW) / 2);
    const trackH = 8;
    const rowH = M.small + 12 + trackH + 26;
    const expSub = profile.description?.slice(0, 200);
    const headH = measureHead("Our expertise", T.expertiseTitle, expSub);
    const h = M.sectionPad * 2 + headH + expertiseItems.length * rowH;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT_2, radius: 0 }));
    heading(y + M.sectionPad, "Our expertise", T.expertiseTitle, expSub, false);
    const top = y + M.sectionPad + headH;

    expertiseItems.forEach((label, i) => {
      const ry = top + i * rowH;
      add(text(pageId, label, barX, ry, barW - 70, { size: M.small + 2, weight: 700, color: INK }));
      add(text(pageId, "00%", barX + barW - 60, ry, 60, { size: M.small + 1, weight: 700, color: MUTED, align: "right" }));
      const ty = ry + M.small + 12;
      add(rect(pageId, barX, ty, barW, trackH, { fill: "#DCE1E5", radius: 4 }));
      add(rect(pageId, barX, ty, barW, trackH, { fill: A, radius: 4 }));
    });
    y += h;
  }

  /* ============================================================== 5. TEAM */
  if (hasTeam) {
    const g = gridOf(profile.team.length, M.teamCols);
    const avatar = device === "mobile" ? 120 : 140;
    const bodyH = textHeight(LOREM_SHORT, g.cardW - 44, M.small);
    const cardH = 34 + avatar + 22 + M.h3 + 10 + M.small + 14 + bodyH + 18 + 26 + 30;
    const rows = Math.ceil(profile.team.length / g.c);
    const headH = measureHead("Our team", T.teamTitle, undefined);
    const h = M.sectionPad * 2 + headH + rows * cardH + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, "Our team", T.teamTitle, undefined, false);
    const top = y + M.sectionPad + headH;

    profile.team.forEach((member, i) => {
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, x, cy, g.cardW, cardH, { fill: LIGHT_2, radius: 6 }));
      const ax = x + Math.round((g.cardW - avatar) / 2);
      const ay = cy + 34;
      add(circle(pageId, ax - 6, ay - 6, avatar + 12, "#E1E6EA"));
      if (member.photo) add(image(pageId, member.photo, ax, ay, avatar, avatar, Math.round(avatar / 2)));
      else {
        add(circle(pageId, ax, ay, avatar, "#C9CFD4"));
        add(icon(pageId, "User", ax + avatar / 2 - 22, ay + avatar / 2 - 22, 44, "#FFFFFF"));
      }
      let ty = ay + avatar + 22;
      add(text(pageId, member.name, x + 20, ty, g.cardW - 40, { size: M.h3, weight: 800, color: INK, align: "center" }));
      ty += M.h3 + 10;
      add(text(pageId, member.role || LOREM_SHORT.slice(0, 18), x + 20, ty, g.cardW - 40, { size: M.small, weight: 700, color: A, align: "center" }));
      ty += M.small + 14;
      add(text(pageId, (member.body ?? LOREM_SHORT).slice(0, 150), x + 22, ty, g.cardW - 44, { size: M.small, color: MUTED, align: "center", height: bodyH }));
      ty += bodyH + 18;
      /* social/action icon row */
      const socials = (profile.socials ?? []).slice(0, 3);
      const iconNames = socials.length ? socials.map(() => "Link") : ["Mail", "Phone", "Link"];
      const iw = 26;
      const startIx = x + Math.round((g.cardW - (iconNames.length * iw + (iconNames.length - 1) * 14)) / 2);
      iconNames.forEach((n, ii) => {
        const ic = icon(pageId, n, startIx + ii * (iw + 14), ty, iw, "#8A9299");
        const s = socials[ii];
        if (s?.url) ic.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
        add(ic);
      });
    });
    y += h;
  }

  /* ======================================================== 6. STATISTICS */
  if (hasStats) {
    const g = gridOf(profile.stats.length, M.statCols);
    const rows = Math.ceil(profile.stats.length / g.c);
    const rowH = device === "mobile" ? 132 : 156;
    const h = M.sectionPad + rows * rowH + M.sectionPad;
    photoBand(y, h, photo(2) || heroImage, "#3A4247", 0.78);
    const top = y + M.sectionPad;
    profile.stats.forEach((s, i) => {
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * rowH;
      const numSize = device === "mobile" ? 46 : 64;
      add(text(pageId, s.value, x, cy, g.cardW, { size: numSize, weight: 800, color: ON_DARK, align: "center", height: Math.round(numSize * 1.2) }));
      add(rect(pageId, x + Math.round(g.cardW / 2) - 18, cy + Math.round(numSize * 1.2) + 8, 36, 3, { fill: A, radius: 2 }));
      add(text(pageId, s.label.toUpperCase(), x, cy + Math.round(numSize * 1.2) + 24, g.cardW, { size: M.small, weight: 700, color: ON_DARK_MUTED, align: "center" }));
    });
    y += h;
  }

  /* ==================================================== 7. WORK/PORTFOLIO */
  if (hasWork) {
    const categories = Array.from(
      new Set((profile.portfolio ?? []).map((p) => p.category).filter(Boolean) as string[])
    ).slice(0, 4);
    const headH = measureHead(T.workLabel, T.workTitle, profile.tagline);
    const filterH = 60;
    const tileCount = device === "mobile" ? 6 : 8;
    const tiles: Array<string | undefined> = galleryImages.length
      ? galleryImages.slice(0, tileCount)
      : Array.from({ length: 4 }, () => undefined);
    const g = gridOf(tiles.length, M.workCols, W, 0);
    const tileH = Math.round(g.cardW * 0.86);
    const rows = Math.ceil(tiles.length / g.c);
    const h = M.sectionPad + headH + filterH + rows * tileH + M.sectionPad / 2;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    const headTop = y + M.sectionPad;
    heading(headTop, T.workLabel, T.workTitle, profile.tagline, false);
    /* filter chips — real categories when known, otherwise an "All" chip */
    const chips = ["All", ...categories];
    const chipW = Math.min(130, Math.round(COL / Math.max(3, chips.length + 1)));
    const startX = PAD + Math.round((COL - (chips.length * (chipW + 10) - 10)) / 2);
    chips.forEach((c, i) => {
      add(rect(pageId, startX + i * (chipW + 10), headTop + headH, chipW, 38, { fill: i === 0 ? A : LIGHT_2, radius: 3 }));
      add(text(pageId, c, startX + i * (chipW + 10), headTop + headH + 11, chipW, {
        size: M.small, weight: 700, color: i === 0 ? "#FFFFFF" : DARK, align: "center",
      }));
    });
    const gridTop = headTop + headH + filterH;
    tiles.forEach((src, i) => {
      const x = g.xOf(i);
      const cy = gridTop + g.rowOf(i) * tileH;
      if (src) add(image(pageId, src, x, cy, g.cardW, tileH, 0));
      else add(rect(pageId, x, cy, g.cardW, tileH, { fill: "#DCE1E5", radius: 0 }));
      const entry = src
        ? (profile.portfolio ?? []).find((p) => p.image === src) ?? (profile.portfolio ?? [])[i]
        : (profile.portfolio ?? [])[i];
      const capTitle = entry?.title ?? LOREM_NAME;
      const capSub = entry?.category ?? LOREM_SHORT.slice(0, 26);
      add(rect(pageId, x, cy + tileH - 74, g.cardW, 74, { fill: "#101418", radius: 0, opacity: 0.62 }));
      add(text(pageId, capTitle, x + 16, cy + tileH - 58, g.cardW - 32, { size: M.small + 1, weight: 700, color: ON_DARK }));
      add(text(pageId, capSub, x + 16, cy + tileH - 34, g.cardW - 32, { size: M.small - 1, color: ON_DARK_MUTED }));
    });
    y += h;
  }

  /* ====================================================== 8. FEATURED WORK */
  const featuredImage = galleryImages[1] || galleryImages[0] || heroImage;
  if (hasFeatured) {
    const featured = (profile.portfolio ?? [])[0];
    const featSub = featured?.description ?? profile.tagline;
    const headH = measureHead("Featured", T.featuredTitle, featSub);
    const showW = Math.round(COL * (device === "mobile" ? 1 : device === "tablet" ? 0.9 : 0.72));
    const showH = Math.round(showW * 0.56);
    const frame = 16;
    const capH = M.h3 + 14 + textHeight(LOREM_SHORT, showW - 40, M.small) + 30;
    const h = Math.round(M.sectionPad * 2.4) + headH + showH + frame * 2 + capH;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT_2, radius: 0 }));
    heading(y + Math.round(M.sectionPad * 1.2), "Featured", T.featuredTitle, featSub, false);

    const fx = PAD + Math.round((COL - showW) / 2);
    const fy = y + Math.round(M.sectionPad * 1.2) + headH;
    add(rect(pageId, fx, fy, showW, showH + frame * 2, { fill: "#2C3235", radius: 8 }));
    if (featuredImage) add(image(pageId, featuredImage, fx + frame, fy + frame, showW - frame * 2, showH, 2));
    else {
      add(rect(pageId, fx + frame, fy + frame, showW - frame * 2, showH, { fill: "#DCE1E5", radius: 2 }));
      add(text(pageId, LOREM_SHORT, fx + frame + 20, fy + frame + Math.round(showH / 2) - 10, showW - frame * 2 - 40, { size: M.small + 1, color: MUTED, align: "center" }));
    }
    const cy = fy + showH + frame * 2 + 26;
    add(text(pageId, featured?.title ?? LOREM_NAME, fx, cy, showW, { size: M.h3, weight: 800, color: INK, align: "center" }));
    add(
      text(pageId, (featured?.description ?? LOREM_SHORT).slice(0, 180), fx + 20, cy + M.h3 + 14, showW - 40, {
        size: M.small, color: MUTED, align: "center",
      })
    );
    y += h;
  }

  /* ====================================================== 9. TESTIMONIALS */
  if (hasTestimonials) {
    const t0 = profile.testimonials[0];
    const boxW = Math.round(COL * (device === "mobile" ? 1 : 0.74));
    const quoteH = textHeight(t0.body, boxW - 92, M.body + 2);
    const avatar = 72;
    const boxH = 56 + 44 + quoteH + 30 + avatar + 56;
    const h = M.sectionPad * 2 + 118 + boxH;
    photoBand(y, h, photo(3) || heroImage, "#3A4247", 0.74);
    add(text(pageId, "What people say", PAD, y + M.sectionPad, COL, { size: M.h2, weight: 800, color: ON_DARK, align: "center" }));
    add(rect(pageId, Math.round(W / 2 - 26), y + M.sectionPad + M.h2 + 18, 52, 3, { fill: A, radius: 2 }));

    const bx0 = PAD + Math.round((COL - boxW) / 2);
    const by0 = y + M.sectionPad + 118;
    add(rect(pageId, bx0, by0, boxW, boxH, { fill: "#FFFFFF", radius: 6, opacity: 0.1, stroke: "#FFFFFF", strokeWidth: 1 }));
    add(icon(pageId, "Quote", Math.round(W / 2 - 18), by0 + 32, 36, A));
    add(
      text(pageId, `“${t0.body}”`, bx0 + 46, by0 + 56 + 38, boxW - 92, {
        size: M.body + 2, color: ON_DARK, align: "center", italic: true, height: quoteH,
      })
    );
    const ay = by0 + 56 + 38 + quoteH + 26;
    const ax = Math.round(W / 2 - avatar / 2);
    if (t0.photo) add(image(pageId, t0.photo, ax, ay, avatar, avatar, Math.round(avatar / 2)));
    else {
      add(circle(pageId, ax, ay, avatar, "#C9CFD4"));
      add(icon(pageId, "User", ax + avatar / 2 - 16, ay + avatar / 2 - 16, 32, "#FFFFFF"));
    }
    add(text(pageId, t0.name || LOREM_NAME, PAD, ay + avatar + 12, COL, { size: M.small + 2, weight: 800, color: A, align: "center" }));
    y += h;
  }

  /* =============================================== 10. PRICING / PACKAGES */
  if (hasPackages) {
    const plans = profile.pricing.map((p) => ({ name: p.name, price: p.price, features: p.features }));
    const g = gridOf(plans.length, Math.min(3, M.cols));
    const maxFeatures = Math.max(0, ...plans.map((p) => p.features.length));
    const cardH = 34 + M.h3 + 18 + 56 + 22 + maxFeatures * 36 + 20 + M.btnH + 34;
    const rows = Math.ceil(plans.length / g.c);
    const headH = measureHead("Pricing", T.pricingTitle, undefined);
    const h = M.sectionPad * 2 + headH + rows * (cardH + 28) + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, "Pricing", T.pricingTitle, undefined, false);
    const top = y + M.sectionPad + headH;

    plans.forEach((plan, i) => {
      const featured = plans.length === 3 && i === 1;
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * (cardH + 28 + M.gap) + (featured ? 0 : 28);
      const ch = featured ? cardH + 28 : cardH;
      const innerW = g.cardW - 44;
      add(
        rect(pageId, x, cy, g.cardW, ch, {
          fill: featured ? A : "#FFFFFF",
          radius: 6,
          stroke: featured ? A : "#DCE1E5",
          strokeWidth: 1,
        })
      );
      const onDark = featured;
      let py = cy + 34;
      add(text(pageId, plan.name, x + 22, py, innerW, { size: M.h3 + 1, weight: 800, color: onDark ? "#FFFFFF" : INK, align: "center" }));
      py += M.h3 + 18;
      add(
        text(pageId, plan.price, x + 22, py, innerW, {
          size: device === "mobile" ? 34 : 42, weight: 800, color: onDark ? "#FFFFFF" : A, align: "center", height: 56,
        })
      );
      py += 56 + 22;
      plan.features.forEach((f, fi) => {
        add(rect(pageId, x + 22, py + fi * 36 - 8, innerW, 1, { fill: onDark ? "#FFFFFF" : "#E4E8EB", opacity: onDark ? 0.25 : 1 }));
        add(text(pageId, f.slice(0, 70), x + 22, py + fi * 36, innerW, { size: M.small, color: onDark ? "#EDF1F3" : MUTED, align: "center" }));
      });
      const cta = primaryCta;
      add(
        button(pageId, cta?.label ?? T.primaryCta, x + 22, cy + ch - 34 - M.btnH, innerW, M.btnH, {
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
  if (hasClients) {
    const items = profile.socials.length
      ? profile.socials.slice(0, 5).map((s) => ({ label: s.label, url: s.url }))
      : placeholderClients(device === "mobile" ? 2 : device === "tablet" ? 3 : 5).map((label) => ({ label, url: "" }));
    const boxH = device === "mobile" ? 82 : 96;
    const cols = Math.min(items.length, device === "mobile" ? 2 : device === "tablet" ? 3 : 5);
    const cardW = Math.round((COL - M.gap * (cols - 1)) / cols);
    const rows = Math.ceil(items.length / cols);
    const h = M.sectionPad * 2 + 118 + rows * boxH + (rows - 1) * M.gap;
    photoBand(y, h, photo(4) || heroImage, "#3A4247", 0.76);
    add(text(pageId, profile.socials.length ? "Connect with us" : "Our clients", PAD, y + M.sectionPad, COL, { size: M.h2 - 2, weight: 800, color: ON_DARK, align: "center" }));
    add(rect(pageId, Math.round(W / 2 - 26), y + M.sectionPad + M.h2 + 14, 52, 3, { fill: A, radius: 2 }));

    const top = y + M.sectionPad + 118;
    items.forEach((s, i) => {
      const x = PAD + (i % cols) * (cardW + M.gap);
      const cy = top + Math.floor(i / cols) * (boxH + M.gap);
      add(rect(pageId, x, cy, cardW, boxH, { fill: "#FFFFFF", radius: 4, opacity: 0.1, stroke: "#FFFFFF", strokeWidth: 1 }));
      const l = text(pageId, s.label, x + 10, cy + Math.round(boxH / 2) - 10, cardW - 20, {
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
    const entryImgH = Math.round(g.cardW * 0.58);
    const excerptH = textHeight(LOREM_LONG, g.cardW - 44, M.small);
    const entryH = entryImgH + 22 + M.small + 12 + M.h3 + 12 + excerptH + 18 + M.small + 26;
    const rows = Math.ceil(profile.news.length / g.c);
    const headH = measureHead("Latest", T.newsTitle, undefined);
    const h = M.sectionPad * 2 + headH + rows * entryH + (rows - 1) * M.gap;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    heading(y + M.sectionPad, "Latest", T.newsTitle, undefined, false);
    const top = y + M.sectionPad + headH;

    profile.news.forEach((n, i) => {
      const x = g.xOf(i);
      const cy = top + g.rowOf(i) * (entryH + M.gap);
      add(rect(pageId, x, cy, g.cardW, entryH, { fill: "#FFFFFF", radius: 6, stroke: "#E4E8EB", strokeWidth: 1 }));
      /* Never a broken/empty image state — unknown news art uses a neutral,
         editable placeholder photo. */
      add(image(pageId, n.image || websitePlaceholderImg, x, cy, g.cardW, entryImgH, 6));
      let ny = cy + entryImgH + 22;
      /* category / date line — editable placeholder when unknown */
      add(text(pageId, LOREM_NAME.toUpperCase(), x + 22, ny, g.cardW - 44, { size: M.small - 1, weight: 700, color: A }));
      ny += M.small + 12;
      add(text(pageId, n.title, x + 22, ny, g.cardW - 44, { size: M.h3, weight: 800, color: INK }));
      ny += M.h3 + 12;
      add(text(pageId, (n.body ?? LOREM_LONG).slice(0, 180), x + 22, ny, g.cardW - 44, { size: M.small, color: MUTED, height: excerptH }));
      ny += excerptH + 18;
      const more = text(pageId, "Read more", x + 22, ny, g.cardW - 44, { size: M.small, weight: 700, color: A });
      more.action = anchor("contact");
      add(more);
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

    const formW = Math.round(COL * (device === "mobile" ? 1 : device === "tablet" ? 0.85 : 0.58));
    const formPad = device === "mobile" ? 22 : 34;
    const fieldGap = 14;
    const fieldsH = 52 * 2 + 104 + fieldGap * 2;
    const formH = formPad * 2 + 48 + fieldsH + 20 + M.btnH;
    const infoRows = M.stackContact ? infoLines.length : 1;
    const infoH = infoRows * 42 + 40;
    const socialH = profile.socials.length ? 52 : 0;
    const h = M.sectionPad * 2 + 104 + formH + infoH + socialH;

    photoBand(y, h, photo(5) || heroImage, "#3A4247", 0.78);
    add(text(pageId, T.contactTitle, PAD, y + M.sectionPad, COL, { size: M.h2, weight: 800, color: ON_DARK, align: "center" }));
    add(rect(pageId, Math.round(W / 2 - 26), y + M.sectionPad + M.h2 + 16, 52, 3, { fill: A, radius: 2 }));

    const fx = PAD + Math.round((COL - formW) / 2);
    const fy0 = y + M.sectionPad + 104;
    add(rect(pageId, fx, fy0, formW, formH, { fill: "#FFFFFF", radius: 6, opacity: 0.96 }));
    add(text(pageId, `Message ${name}`, fx + formPad, fy0 + formPad, formW - formPad * 2, { size: M.h3, weight: 800, color: INK, align: "center" }));
    let fy = fy0 + formPad + 52;
    ["Your name", "Email address", "Message"].forEach((label, i) => {
      const hh = i === 2 ? 104 : 52;
      add(rect(pageId, fx + formPad, fy, formW - formPad * 2, hh, { fill: LIGHT_2, radius: 3, stroke: "#E4E8EB", strokeWidth: 1 }));
      add(text(pageId, label, fx + formPad + 16, fy + 17, formW - formPad * 2 - 32, { size: M.small + 1, color: MUTED }));
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
    const iy = fy0 + formH + 40;
    const per = Math.round(COL / Math.max(1, infoLines.length));
    infoLines.forEach(([ic, value], i) => {
      const cx = M.stackContact ? PAD : PAD + i * per;
      const cy = M.stackContact ? iy + i * 42 : iy;
      const w = M.stackContact ? COL : per;
      add(icon(pageId, ic, cx + (M.stackContact ? 0 : Math.round(w / 2) - 46), cy, 22, A));
      add(text(pageId, value, cx + (M.stackContact ? 32 : Math.round(w / 2) - 18), cy + 2, M.stackContact ? w - 32 : w - 40, {
        size: M.small + 1, color: ON_DARK,
      }));
    });

    if (profile.socials.length) {
      const sy = iy + infoRows * 42 + 20;
      const socials = profile.socials.slice(0, 5);
      const sw = 40;
      const sx = PAD + Math.round((COL - (socials.length * sw + (socials.length - 1) * 16)) / 2);
      socials.forEach((s, i) => {
        const ic = icon(pageId, "Link", sx + i * (sw + 16), sy, 26, ON_DARK);
        ic.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
        add(ic);
      });
    }
    y += h;
  }

  /* ============================================================ 14. FOOTER */
  const footerH = device === "mobile" ? 372 : 344;
  add(rect(pageId, 0, y, W, footerH, { fill: "#2C3235", radius: 0 }));
  const logoS = device === "mobile" ? 46 : 56;
  if (profile.logoUrl) add(image(pageId, profile.logoUrl, Math.round(W / 2 - logoS / 2), y + 60, logoS, logoS, 6));
  else add(icon(pageId, "Sparkles", Math.round(W / 2 - 22), y + 62, 44, A));
  add(text(pageId, name, PAD, y + 60 + logoS + 22, COL, { size: M.h3 + 2, weight: 800, color: ON_DARK, align: "center" }));

  const navRowY = y + 60 + logoS + 22 + M.h3 + 42;
  const navPer = Math.round(COL / Math.max(1, navItems.length));
  navItems.forEach(([label, hash], i) => {
    const l = text(pageId, label, PAD + i * navPer, navRowY, navPer, { size: M.small, weight: 600, color: ON_DARK_MUTED, align: "center" });
    l.action = anchor(hash);
    add(l);
  });

  if (profile.socials.length) {
    const per = Math.round(COL / profile.socials.length);
    profile.socials.slice(0, 6).forEach((s, i) => {
      const l = text(pageId, s.label, PAD + i * per, navRowY + 34, per, { size: M.small, weight: 600, color: A, align: "center" });
      l.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
      add(l);
    });
  }

  const contactLine = [profile.phone, profile.email, profile.address].filter(Boolean).join("  ·  ");
  if (contactLine) {
    add(text(pageId, contactLine, PAD, navRowY + (profile.socials.length ? 72 : 40), COL, { size: M.small, color: ON_DARK_MUTED, align: "center" }));
  }
  add(rect(pageId, PAD, y + footerH - 58, COL, 1, { fill: "#454C51", radius: 0 }));
  add(
    text(pageId, `© ${new Date().getFullYear()} ${name}. All rights reserved.`, PAD, y + footerH - 38, COL, {
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
