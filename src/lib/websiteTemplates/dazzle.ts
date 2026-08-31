import { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import {
  DEFAULT_WEBSITE_SECTIONS,
  type WebsiteProfile,
  type WebsiteSectionKey,
} from "@/lib/websiteProfile";
import { withWavexPlaceholders } from "@/lib/websitePlaceholders";
import type { WebsiteDevice } from "@/lib/websitePage";

/**
 * DAZZLE — one-page app/product landing template.
 *
 * Converted from the classic Dazzle HTML5/CSS3 one-pager into NATIVE editor
 * layers: it produces the exact same FlyerPage / Layer / LayerAction data model
 * every other TapThatFlyer website page uses, so the existing editor, action
 * system, responsive rebuild, public renderer and publishing flow all work
 * unchanged. No iframe, no second website system.
 *
 * Dazzle design language kept:
 *   • deep violet → magenta gradient hero with a centred product/app visual
 *   • rounded pill buttons, generous section rhythm, wide letter-spaced eyebrows
 *   • soft white feature cards with circular icon badges on a tinted background
 *   • alternating light / tinted / gradient bands
 *   • gradient statistics + CTA "download" bands
 *   • quote-card testimonials, 3-up pricing with a highlighted middle plan
 *   • dark footer with brand, nav, socials and copyright
 *
 * Section order (optional sections respect the client's picker choices):
 *   Header → Hero → Features → About/Why → Showcase → Screenshots →
 *   Stats → Team → Testimonials → Pricing → Clients → News →
 *   CTA band → Contact → Footer
 */

/* ------------------------------------------------------------ palette */

const INK = "#1B1533";
const BODY = "#6B6787";
const LIGHT = "#FFFFFF";
const TINT = "#F7F5FF";
const DEEP = "#3B1E70";
const DEEP_2 = "#7A2E9E";
const ON_DARK = "#FFFFFF";
const ON_DARK_MUTED = "#E4D8F5";
const FOOTER_BG = "#241A3C";
const ACCENT = "#FF4E8E";

const FONT = "Montserrat";

/* ------------------------------------------------------------- metrics */

type Metrics = {
  W: number;
  PAD: number;
  COL: number;
  gap: number;
  navH: number;
  heroFont: number;
  eyebrow: number;
  h2: number;
  h3: number;
  body: number;
  small: number;
  featureCols: number;
  shotCols: number;
  teamCols: number;
  statCols: number;
  priceCols: number;
  newsCols: number;
  sectionPad: number;
  btnH: number;
  radius: number;
  stack: boolean;
  compactNav: boolean;
};

function metricsFor(device: WebsiteDevice): Metrics {
  switch (device) {
    case "mobile":
      return {
        W: 430, PAD: 20, COL: 390, gap: 16,
        navH: 128, heroFont: 34, eyebrow: 12, h2: 26, h3: 18, body: 15, small: 13,
        featureCols: 1, shotCols: 2, teamCols: 1, statCols: 2, priceCols: 1, newsCols: 1,
        sectionPad: 52, btnH: 52, radius: 26,
        stack: true, compactNav: true,
      };
    case "tablet":
      return {
        W: 834, PAD: 40, COL: 754, gap: 20,
        navH: 84, heroFont: 46, eyebrow: 13, h2: 32, h3: 19, body: 16, small: 14,
        featureCols: 2, shotCols: 3, teamCols: 2, statCols: 4, priceCols: 3, newsCols: 2,
        sectionPad: 68, btnH: 54, radius: 27,
        stack: false, compactNav: true,
      };
    default:
      return {
        W: 1440, PAD: 120, COL: 1200, gap: 30,
        navH: 90, heroFont: 60, eyebrow: 14, h2: 40, h3: 21, body: 17, small: 14,
        featureCols: 3, shotCols: 4, teamCols: 4, statCols: 4, priceCols: 3, newsCols: 3,
        sectionPad: 96, btnH: 56, radius: 28,
        stack: false, compactNav: false,
      };
  }
}

/* ------------------------------------------------------------- helpers */

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

function textHeight(value: string, width: number, size: number) {
  const perLine = Math.max(6, Math.floor(width / (size * 0.54)));
  const lines = value
    .split("\n")
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  return Math.round(lines * size * 1.45);
}

function text(
  pageId: string,
  value: string,
  x: number,
  y: number,
  width: number,
  opts: {
    size?: number;
    weight?: number;
    color?: string;
    align?: "left" | "center" | "right";
    height?: number;
    italic?: boolean;
  } = {}
): Layer {
  const size = opts.size ?? 17;
  return {
    ...base(pageId, "text"),
    position: { x, y },
    size: { width, height: opts.height ?? textHeight(value, width, size) },
    style: {
      fontFamily: FONT,
      fontSize: size,
      fontWeight: opts.weight ?? 400,
      color: opts.color ?? BODY,
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

function circle(pageId: string, x: number, y: number, size: number, fill: string, opacity = 1): Layer {
  return {
    ...base(pageId, "shape"),
    position: { x, y },
    size: { width: size, height: size },
    style: { fill, cornerRadius: Math.round(size / 2), opacity },
    content: { shape: "circle" },
  };
}

function image(pageId: string, src: string, x: number, y: number, width: number, height: number, radius = 0): Layer {
  return {
    ...base(pageId, "image"),
    position: { x, y },
    size: { width, height },
    style: { cornerRadius: radius, fit: "cover" },
    content: { src },
  };
}

function icon(pageId: string, name: string, x: number, y: number, size = 34, color = ACCENT): Layer {
  return {
    ...base(pageId, "icon"),
    position: { x, y },
    size: { width: size, height: size },
    style: { color },
    content: { iconName: name },
  };
}

/** Dazzle buttons are fully rounded pills. */
function pill(
  pageId: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { fill?: string; color?: string; size?: number; action?: LayerAction | null; stroke?: string } = {}
): Layer {
  return {
    ...base(pageId, "button"),
    position: { x, y },
    size: { width, height },
    style: {
      fill: opts.fill ?? ACCENT,
      color: opts.color ?? "#FFFFFF",
      cornerRadius: Math.round(height / 2),
      fontSize: opts.size ?? 15,
      fontWeight: 700,
      fontFamily: FONT,
      align: "center",
      stroke: opts.stroke,
      strokeWidth: opts.stroke ? 2 : undefined,
    },
    content: { label },
    action: opts.action ?? null,
  };
}

function anchor(hash: string): LayerAction {
  return { id: uid(), type: "open_url", payload: { url: `#${hash}`, newTab: false } };
}

const cloneAction = (a: LayerAction): LayerAction => ({ ...a, id: uid(), payload: { ...a.payload } });

const FEATURE_ICONS = ["Zap", "ShieldCheck", "Sparkles", "HeartHandshake", "Rocket", "Star"];

/* ---------------------------------------------------------------- build */

/**
 * Builds the Dazzle Website page for the CURRENT client and project at the
 * given viewport. Every string/image/action produced here is a normal editable
 * layer — nothing is baked in as uneditable production copy.
 */
export function buildDazzleWebsitePage(
  flyerId: string,
  index: number,
  rawProfile: WebsiteProfile,
  device: WebsiteDevice = "desktop"
): FlyerPage {
  const profile = {
    ...withWavexPlaceholders(rawProfile),
    sections: rawProfile.sections ?? DEFAULT_WEBSITE_SECTIONS,
  };
  Z = 0;
  const pageId = uid();
  const M = metricsFor(device);
  const { W, PAD, COL } = M;
  const L: Layer[] = [];
  const add = (...l: Layer[]) => L.push(...l);
  let y = 0;

  const A = profile.brandColors?.accent || ACCENT;
  const name = profile.businessName?.trim() || "Your business";
  const images = profile.images ?? [];
  const heroImage = profile.heroImage || images[0];
  const photo = (i: number) => (images.length ? images[i % images.length] : undefined);

  const picked = rawProfile.sections ?? DEFAULT_WEBSITE_SECTIONS;
  const on = (k: WebsiteSectionKey) => picked.includes(k);

  const hasFeatures = on("intro");
  const hasAbout = on("expertise");
  const hasShowcase = on("featured");
  const hasShots = on("work");
  const hasStats = on("stats");
  const hasTeam = on("team");
  const hasTestimonials = on("testimonials");
  const hasPricing = on("pricing");
  const hasClients = on("clients");
  const hasNews = on("news");
  const hasContact = on("contact");

  const primaryCta = profile.ctas?.[0];
  const secondaryCta = profile.ctas?.[1];

  const grid = (count: number, cols: number, width = COL, left = PAD) => {
    const c = Math.min(cols, Math.max(1, count));
    const cardW = Math.round((width - M.gap * (c - 1)) / c);
    return {
      c,
      cardW,
      xOf: (i: number) => left + (i % c) * (cardW + M.gap),
      rowOf: (i: number) => Math.floor(i / c),
    };
  };

  /** Dazzle heading: letter-spaced eyebrow, bold title, short lead + accent rule. */
  const heading = (
    yy: number,
    eyebrowText: string | undefined,
    title: string,
    sub: string | undefined,
    onDark: boolean
  ) => {
    let h = 0;
    if (eyebrowText) {
      add(
        text(pageId, eyebrowText.toUpperCase().split("").join(" "), PAD, yy, COL, {
          size: M.eyebrow,
          weight: 700,
          color: onDark ? ON_DARK_MUTED : A,
          align: "center",
        })
      );
      h += M.eyebrow * 2 + 6;
    }
    const titleH = textHeight(title, COL, M.h2);
    add(
      text(pageId, title, PAD, yy + h, COL, {
        size: M.h2,
        weight: 800,
        color: onDark ? ON_DARK : INK,
        align: "center",
        height: titleH,
      })
    );
    h += titleH + 14;
    add(rect(pageId, Math.round(W / 2 - 26), yy + h, 52, 3, { fill: A, radius: 2 }));
    h += 22;
    if (sub) {
      const subW = Math.min(COL, device === "desktop" ? 720 : COL);
      const subX = PAD + Math.round((COL - subW) / 2);
      const subH = textHeight(sub, subW, M.body);
      add(
        text(pageId, sub, subX, yy + h, subW, {
          size: M.body,
          color: onDark ? ON_DARK_MUTED : BODY,
          align: "center",
          height: subH,
        })
      );
      h += subH;
    }
    return h + 36;
  };

  const headingHeight = (eyebrowText: string | undefined, title: string, sub: string | undefined) => {
    let h = eyebrowText ? M.eyebrow * 2 + 6 : 0;
    h += textHeight(title, COL, M.h2) + 14 + 22;
    if (sub) h += textHeight(sub, Math.min(COL, device === "desktop" ? 720 : COL), M.body);
    return h + 36;
  };

  /* ======================================================== 1. HEADER */

  const navItems: Array<[string, string]> = [["Home", "hero"]];
  if (hasFeatures) navItems.push(["Features", "features"]);
  if (hasAbout) navItems.push(["About", "about"]);
  if (hasShots) navItems.push(["Gallery", "screens"]);
  if (hasTestimonials) navItems.push(["Reviews", "testimonials"]);
  if (hasPricing) navItems.push(["Pricing", "pricing"]);
  if (hasContact) navItems.push(["Contact", "contact"]);

  const logoSize = device === "mobile" ? 34 : 40;
  let navH = M.navH;

  if (device === "mobile") {
    const barH = 62;
    const chipW = Math.round((COL - 8 * 2) / 3);
    const chipRows = Math.ceil(navItems.length / 3);
    navH = barH + chipRows * 36 + 12;
    add(rect(pageId, 0, 0, W, navH, { fill: LIGHT, radius: 0 }));
    if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, 14, logoSize, logoSize, 10));
    else add(icon(pageId, "Sparkles", PAD, 16, 28, A));
    add(
      text(pageId, name, PAD + logoSize + 10, 22, W - PAD * 2 - logoSize - 20, {
        size: 17,
        weight: 800,
        color: INK,
      })
    );
    navItems.forEach(([label, hash], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const l = text(pageId, label, PAD + col * (chipW + 8), barH + row * 36 + 8, chipW, {
        size: 13,
        weight: 600,
        color: BODY,
        align: "center",
      });
      l.action = anchor(hash);
      add(l);
    });
  } else {
    const itemW = M.compactNav ? 80 : 100;
    const ctaW = M.compactNav ? 128 : 158;
    const ctaH = 44;
    add(rect(pageId, 0, 0, W, navH, { fill: LIGHT, radius: 0 }));
    if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, (navH - logoSize) / 2, logoSize, logoSize, 10));
    else add(icon(pageId, "Sparkles", PAD, (navH - 36) / 2, 36, A));
    add(
      text(pageId, name, PAD + logoSize + 12, navH / 2 - 13, device === "tablet" ? 180 : 320, {
        size: device === "tablet" ? 18 : 22,
        weight: 800,
        color: INK,
      })
    );
    const navRight = hasContact ? W - PAD - ctaW - 18 : W - PAD;
    const navStart = navRight - navItems.length * itemW;
    navItems.forEach(([label, hash], i) => {
      const l = text(pageId, label, navStart + i * itemW, navH / 2 - 9, itemW - 6, {
        size: M.compactNav ? 13 : 14,
        weight: 600,
        color: INK,
        align: "center",
      });
      l.action = anchor(hash);
      add(l);
    });
    if (hasContact) {
      add(
        pill(pageId, "Get started", W - PAD - ctaW, (navH - ctaH) / 2, ctaW, ctaH, {
          fill: A,
          size: M.compactNav ? 13 : 14,
          action: anchor("contact"),
        })
      );
    }
  }
  add(rect(pageId, 0, navH - 1, W, 1, { fill: "#EDE9F8", radius: 0 }));

  /* ========================================================== 2. HERO */

  y = navH;
  const headlineText =
    profile.headline && profile.headline !== name ? profile.headline : profile.tagline || name;
  const heroSupport = profile.description || (headlineText !== profile.tagline ? profile.tagline : undefined);
  const heroSplit = device === "desktop";
  const heroTextW = heroSplit ? Math.round(COL * 0.52) : COL;
  const heroTextX = heroSplit ? PAD : PAD;
  const headlineH = textHeight(headlineText, heroTextW, M.heroFont);
  const supportH = heroSupport ? textHeight(heroSupport.slice(0, 240), heroTextW, M.body + 1) : 0;
  const heroCtas = [primaryCta, secondaryCta].filter(Boolean).length || (hasContact ? 1 : 0);
  const ctaBlockH = heroCtas === 0 ? 0 : M.stack ? heroCtas * (M.btnH + 12) : M.btnH + 12;
  const heroVisualH = heroSplit ? 420 : device === "tablet" ? 320 : 240;
  const heroTextBlock = headlineH + 22 + supportH + 34 + ctaBlockH;
  const heroH = heroSplit
    ? Math.max(660, 120 + Math.max(heroTextBlock, heroVisualH) + 120)
    : Math.max(device === "mobile" ? 660 : 640, 90 + heroTextBlock + 40 + heroVisualH + 80);

  /* Deep violet → magenta gradient band, faked with layered translucent shapes
     so it stays a normal editable set of layers. */
  add(rect(pageId, 0, y, W, heroH, { fill: DEEP, radius: 0 }));
  add(rect(pageId, 0, y, W, heroH, { fill: DEEP_2, radius: 0, opacity: 0.55 }));
  if (heroImage && !heroSplit) {
    add(image(pageId, heroImage, 0, y, W, heroH, 0));
    add(rect(pageId, 0, y, W, heroH, { fill: DEEP, radius: 0, opacity: 0.78 }));
  }
  /* Signature Dazzle bokeh circles. */
  add(circle(pageId, Math.round(W * 0.06), y + 60, device === "mobile" ? 120 : 200, "#FFFFFF", 0.06));
  add(circle(pageId, Math.round(W * 0.72), y + heroH - 200, device === "mobile" ? 140 : 260, ACCENT, 0.1));

  let hy = y + (heroSplit ? 130 : 90);
  const heroAlign = heroSplit ? "left" : "center";
  add(
    text(pageId, headlineText, heroTextX, hy, heroTextW, {
      size: M.heroFont,
      weight: 800,
      color: ON_DARK,
      align: heroAlign,
      height: headlineH,
    })
  );
  hy += headlineH + 22;
  if (heroSupport) {
    add(
      text(pageId, heroSupport.slice(0, 240), heroTextX, hy, heroTextW, {
        size: M.body + 1,
        color: ON_DARK_MUTED,
        align: heroAlign,
        height: supportH,
      })
    );
    hy += supportH;
  }
  hy += 34;

  const btnW = M.stack ? COL : device === "tablet" ? 210 : 220;
  const ctaDefs: Array<{ label: string; action: LayerAction | null; primary: boolean }> = [];
  if (primaryCta) ctaDefs.push({ label: primaryCta.label, action: cloneAction(primaryCta.action), primary: true });
  else if (hasContact) ctaDefs.push({ label: "Get started", action: anchor("contact"), primary: true });
  if (secondaryCta) ctaDefs.push({ label: secondaryCta.label, action: cloneAction(secondaryCta.action), primary: false });
  else if (hasFeatures) ctaDefs.push({ label: "Learn more", action: anchor("features"), primary: false });

  ctaDefs.forEach((c, i) => {
    const bx = M.stack
      ? PAD
      : heroSplit
        ? heroTextX + i * (btnW + 16)
        : PAD + Math.round((COL - (ctaDefs.length * btnW + (ctaDefs.length - 1) * 16)) / 2) + i * (btnW + 16);
    const by = M.stack ? hy + i * (M.btnH + 12) : hy;
    add(
      pill(pageId, c.label, bx, by, btnW, M.btnH, {
        fill: c.primary ? A : "#FFFFFF",
        color: c.primary ? "#FFFFFF" : DEEP,
        action: c.action,
      })
    );
  });
  hy += ctaBlockH;

  /* Product / app visual: split on desktop, centred below the copy elsewhere. */
  if (heroImage) {
    if (heroSplit) {
      const visW = Math.round(COL * 0.42);
      const visX = PAD + COL - visW;
      const visY = y + Math.round((heroH - heroVisualH) / 2);
      add(rect(pageId, visX - 10, visY - 10, visW + 20, heroVisualH + 20, { fill: "#FFFFFF", radius: 30, opacity: 0.12 }));
      add(image(pageId, heroImage, visX, visY, visW, heroVisualH, 24));
    } else {
      const visW = Math.min(COL, device === "tablet" ? 460 : 300);
      add(image(pageId, heroImage, PAD + Math.round((COL - visW) / 2), hy + 20, visW, heroVisualH, 20));
    }
  }
  y += heroH;

  /* ====================================================== 3. FEATURES */

  if (hasFeatures) {
    const items = (profile.services ?? []).slice(0, 6);
    const g = grid(items.length, M.featureCols);
    const cardH = device === "mobile" ? 210 : 250;
    const rows = Math.ceil(items.length / g.c);
    const headH = headingHeight("Features", "Everything you need", profile.tagline);
    const h = M.sectionPad + headH + rows * (cardH + M.gap) - M.gap + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: TINT, radius: 0 }));
    let iy = y + M.sectionPad;
    iy += heading(iy, "Features", "Everything you need", profile.tagline, false);
    items.forEach((s, i) => {
      const cx = g.xOf(i);
      const cy = iy + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, cx, cy, g.cardW, cardH, { fill: LIGHT, radius: 16 }));
      const badge = 64;
      add(circle(pageId, cx + Math.round((g.cardW - badge) / 2), cy + 30, badge, A, 0.12));
      add(icon(pageId, FEATURE_ICONS[i % FEATURE_ICONS.length], cx + Math.round((g.cardW - 30) / 2), cy + 47, 30, A));
      add(
        text(pageId, s.title, cx + 20, cy + 30 + badge + 18, g.cardW - 40, {
          size: M.h3,
          weight: 700,
          color: INK,
          align: "center",
        })
      );
      if (s.body) {
        add(
          text(pageId, s.body.slice(0, 150), cx + 20, cy + 30 + badge + 18 + M.h3 + 16, g.cardW - 40, {
            size: M.small + 1,
            color: BODY,
            align: "center",
          })
        );
      }
    });
    y += h;
  }

  /* ========================================================= 4. ABOUT */

  if (hasAbout) {
    const aboutImg = photo(1) || heroImage;
    const copy = profile.description || profile.tagline || "";
    const split = device !== "mobile" && !!aboutImg;
    const colW = split ? Math.round((COL - M.gap * 2) / 2) : COL;
    const bullets = (profile.services ?? []).slice(0, 4);
    const copyH = copy ? textHeight(copy, colW, M.body) : 0;
    const bulletH = bullets.length * 44;
    const bodyH = Math.max(
      copyH + 20 + bulletH,
      split ? (device === "tablet" ? 300 : 380) : 0
    );
    const headH = headingHeight("About", `Why choose ${name}`, undefined);
    const h = M.sectionPad + headH + bodyH + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    let ay = y + M.sectionPad;
    ay += heading(ay, "About", `Why choose ${name}`, undefined, false);
    const textX = split ? PAD + colW + M.gap * 2 : PAD;
    if (split && aboutImg) {
      add(image(pageId, aboutImg, PAD, ay, colW, device === "tablet" ? 300 : 380, 18));
    }
    let by = ay;
    if (copy) {
      add(text(pageId, copy, textX, by, colW, { size: M.body, color: BODY, height: copyH }));
      by += copyH + 20;
    }
    bullets.forEach((b, i) => {
      add(icon(pageId, "Check", textX, by + i * 44, 22, A));
      add(
        text(pageId, b.title, textX + 34, by + i * 44 + 2, colW - 34, {
          size: M.body,
          weight: 600,
          color: INK,
        })
      );
    });
    y += h;
  }

  /* ====================================================== 5. SHOWCASE */

  if (hasShowcase) {
    const item = (profile.portfolio ?? [])[0];
    const showImg = item?.image || photo(2) || heroImage;
    const split = device !== "mobile";
    const colW = split ? Math.round((COL - M.gap * 2) / 2) : COL;
    const title = item?.title || "Made for the way you work";
    const bodyText = item?.description || profile.description || "";
    const visH = device === "tablet" ? 320 : 400;
    const titleH = textHeight(title, colW, M.h2);
    const bodyH = bodyText ? textHeight(bodyText, colW, M.body) : 0;
    const stackH = titleH + 18 + bodyH + 30 + M.btnH;
    const h = M.sectionPad + (split ? Math.max(visH, stackH) : stackH + 24 + visH) + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: TINT, radius: 0 }));
    const sy = y + M.sectionPad;
    const visX = split ? PAD + colW + M.gap * 2 : PAD;
    if (showImg) {
      add(
        image(
          pageId,
          showImg,
          split ? visX : PAD,
          split ? sy : sy + stackH + 24,
          colW,
          visH,
          20
        )
      );
    }
    let ty = sy;
    add(text(pageId, title, PAD, ty, colW, { size: M.h2, weight: 800, color: INK, height: titleH }));
    ty += titleH + 18;
    if (bodyText) {
      add(text(pageId, bodyText, PAD, ty, colW, { size: M.body, color: BODY, height: bodyH }));
      ty += bodyH;
    }
    ty += 30;
    add(
      pill(pageId, primaryCta?.label || "See how it works", PAD, ty, Math.min(colW, 230), M.btnH, {
        fill: A,
        action: primaryCta ? cloneAction(primaryCta.action) : anchor(hasContact ? "contact" : "hero"),
      })
    );
    y += h;
  }

  /* =================================================== 6. SCREENSHOTS */

  if (hasShots) {
    const shots = Array.from(
      new Set([
        ...((profile.portfolio ?? []).map((p) => p.image).filter(Boolean) as string[]),
        ...images,
      ])
    ).slice(0, 8);
    const count = shots.length || 4;
    const g = grid(count, M.shotCols);
    const shotH = Math.round(g.cardW * 1.15);
    const rows = Math.ceil(count / g.c);
    const headH = headingHeight("Gallery", "A closer look", undefined);
    const h = M.sectionPad + headH + rows * (shotH + M.gap) - M.gap + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    let gy = y + M.sectionPad;
    gy += heading(gy, "Gallery", "A closer look", undefined, false);
    for (let i = 0; i < count; i++) {
      const cx = g.xOf(i);
      const cy = gy + g.rowOf(i) * (shotH + M.gap);
      add(rect(pageId, cx, cy, g.cardW, shotH, { fill: TINT, radius: 16 }));
      const src = shots[i];
      if (src) add(image(pageId, src, cx, cy, g.cardW, shotH, 16));
      else add(icon(pageId, "Image", cx + Math.round(g.cardW / 2 - 16), cy + Math.round(shotH / 2 - 16), 32, "#C9C1E4"));
    }
    y += h;
  }

  /* ========================================================= 7. STATS */

  if (hasStats) {
    const stats = (profile.stats ?? []).slice(0, 4);
    const g = grid(stats.length, M.statCols);
    const rowH = device === "mobile" ? 110 : 120;
    const rows = Math.ceil(stats.length / g.c);
    const h = M.sectionPad + rows * rowH + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: DEEP, radius: 0 }));
    add(rect(pageId, 0, y, W, h, { fill: DEEP_2, radius: 0, opacity: 0.5 }));
    const sy = y + M.sectionPad;
    stats.forEach((s, i) => {
      const cx = g.xOf(i);
      const cy = sy + g.rowOf(i) * rowH;
      add(
        text(pageId, s.value, cx, cy, g.cardW, {
          size: device === "mobile" ? 32 : 40,
          weight: 800,
          color: ON_DARK,
          align: "center",
        })
      );
      add(
        text(pageId, s.label, cx, cy + (device === "mobile" ? 44 : 54), g.cardW, {
          size: M.small,
          weight: 600,
          color: ON_DARK_MUTED,
          align: "center",
        })
      );
    });
    y += h;
  }

  /* ========================================================== 8. TEAM */

  if (hasTeam) {
    const team = (profile.team ?? []).slice(0, 4);
    const g = grid(team.length, M.teamCols);
    const cardH = device === "mobile" ? 300 : 330;
    const rows = Math.ceil(team.length / g.c);
    const headH = headingHeight("Team", "The people behind it", undefined);
    const h = M.sectionPad + headH + rows * (cardH + M.gap) - M.gap + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    let ty = y + M.sectionPad;
    ty += heading(ty, "Team", "The people behind it", undefined, false);
    team.forEach((m, i) => {
      const cx = g.xOf(i);
      const cy = ty + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, cx, cy, g.cardW, cardH, { fill: TINT, radius: 16 }));
      const av = Math.min(120, g.cardW - 60);
      const ax = cx + Math.round((g.cardW - av) / 2);
      if (m.photo) add(image(pageId, m.photo, ax, cy + 28, av, av, Math.round(av / 2)));
      else {
        add(circle(pageId, ax, cy + 28, av, A, 0.14));
        add(icon(pageId, "User", ax + Math.round(av / 2 - 16), cy + 28 + Math.round(av / 2 - 16), 32, A));
      }
      add(
        text(pageId, m.name, cx + 16, cy + 28 + av + 20, g.cardW - 32, {
          size: M.h3,
          weight: 700,
          color: INK,
          align: "center",
        })
      );
      if (m.role)
        add(
          text(pageId, m.role, cx + 16, cy + 28 + av + 20 + M.h3 + 12, g.cardW - 32, {
            size: M.small,
            weight: 600,
            color: A,
            align: "center",
          })
        );
      if (m.body)
        add(
          text(pageId, m.body.slice(0, 110), cx + 16, cy + 28 + av + 20 + M.h3 + 40, g.cardW - 32, {
            size: M.small,
            color: BODY,
            align: "center",
          })
        );
    });
    y += h;
  }

  /* ================================================== 9. TESTIMONIALS */

  if (hasTestimonials) {
    const items = (profile.testimonials ?? []).slice(0, 3);
    const g = grid(items.length, device === "mobile" ? 1 : device === "tablet" ? 2 : 3);
    const cardH = device === "mobile" ? 250 : 270;
    const rows = Math.ceil(items.length / g.c);
    const headH = headingHeight("Reviews", "What people say", undefined);
    const h = M.sectionPad + headH + rows * (cardH + M.gap) - M.gap + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: TINT, radius: 0 }));
    let ry = y + M.sectionPad;
    ry += heading(ry, "Reviews", "What people say", undefined, false);
    items.forEach((t, i) => {
      const cx = g.xOf(i);
      const cy = ry + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, cx, cy, g.cardW, cardH, { fill: LIGHT, radius: 16 }));
      add(icon(pageId, "Quote", cx + 24, cy + 24, 28, A));
      add(
        text(pageId, t.body.slice(0, 220), cx + 24, cy + 68, g.cardW - 48, {
          size: M.body,
          color: BODY,
          italic: true,
        })
      );
      const av = 46;
      if (t.photo) add(image(pageId, t.photo, cx + 24, cy + cardH - 78, av, av, 23));
      else {
        add(circle(pageId, cx + 24, cy + cardH - 78, av, A, 0.14));
        add(icon(pageId, "User", cx + 24 + 12, cy + cardH - 78 + 12, 22, A));
      }
      add(
        text(pageId, t.name || "", cx + 24 + av + 14, cy + cardH - 68, g.cardW - 48 - av - 14, {
          size: M.small + 1,
          weight: 700,
          color: INK,
        })
      );
      if (t.rating)
        add(
          text(pageId, "★".repeat(Math.max(1, Math.min(5, Math.round(t.rating)))), cx + 24 + av + 14, cy + cardH - 46, 120, {
            size: M.small,
            color: A,
          })
        );
    });
    y += h;
  }

  /* ====================================================== 10. PRICING */

  if (hasPricing) {
    const plans = (profile.pricing ?? []).slice(0, 3);
    const g = grid(plans.length, M.priceCols);
    const maxFeatures = Math.max(1, ...plans.map((p) => Math.min(5, p.features?.length ?? 1)));
    const cardH = 220 + maxFeatures * 30 + M.btnH;
    const rows = Math.ceil(plans.length / g.c);
    const headH = headingHeight("Pricing", "Simple, honest pricing", undefined);
    const h = M.sectionPad + headH + rows * (cardH + M.gap) - M.gap + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    let py = y + M.sectionPad;
    py += heading(py, "Pricing", "Simple, honest pricing", undefined, false);
    plans.forEach((p, i) => {
      const highlight = plans.length > 1 && i === 1;
      const cx = g.xOf(i);
      const cy = py + g.rowOf(i) * (cardH + M.gap);
      add(
        rect(pageId, cx, cy, g.cardW, cardH, {
          fill: highlight ? DEEP : TINT,
          radius: 18,
          stroke: highlight ? undefined : "#E7E1F7",
          strokeWidth: highlight ? undefined : 1,
        })
      );
      const fg = highlight ? ON_DARK : INK;
      const fgMuted = highlight ? ON_DARK_MUTED : BODY;
      add(text(pageId, p.name, cx + 20, cy + 32, g.cardW - 40, { size: M.h3, weight: 700, color: fg, align: "center" }));
      add(
        text(pageId, p.price, cx + 20, cy + 32 + M.h3 + 18, g.cardW - 40, {
          size: device === "mobile" ? 34 : 40,
          weight: 800,
          color: highlight ? ON_DARK : A,
          align: "center",
        })
      );
      const fStart = cy + 32 + M.h3 + 18 + (device === "mobile" ? 52 : 62) + 12;
      (p.features ?? []).slice(0, 5).forEach((f, fi) => {
        add(
          text(pageId, f.slice(0, 60), cx + 20, fStart + fi * 30, g.cardW - 40, {
            size: M.small + 1,
            color: fgMuted,
            align: "center",
          })
        );
      });
      add(
        pill(pageId, "Choose plan", cx + 24, cy + cardH - M.btnH - 24, g.cardW - 48, M.btnH, {
          fill: highlight ? "#FFFFFF" : A,
          color: highlight ? DEEP : "#FFFFFF",
          action: primaryCta ? cloneAction(primaryCta.action) : anchor(hasContact ? "contact" : "hero"),
        })
      );
    });
    y += h;
  }

  /* ====================================================== 11. CLIENTS */

  if (hasClients) {
    const socials = (profile.socials ?? []).slice(0, 6);
    const h = M.sectionPad + 40 + (socials.length ? 60 : 0) + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: TINT, radius: 0 }));
    add(
      text(pageId, "Follow along", PAD, y + M.sectionPad, COL, {
        size: M.h3,
        weight: 700,
        color: INK,
        align: "center",
      })
    );
    if (socials.length) {
      const per = Math.round(COL / socials.length);
      socials.forEach((s, i) => {
        const l = text(pageId, s.label, PAD + i * per, y + M.sectionPad + 52, per, {
          size: M.small + 1,
          weight: 700,
          color: A,
          align: "center",
        });
        l.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
        add(l);
      });
    }
    y += h;
  }

  /* ========================================================= 12. NEWS */

  if (hasNews) {
    const news = (profile.news ?? []).slice(0, 3);
    const g = grid(news.length, M.newsCols);
    const cardH = device === "mobile" ? 320 : 340;
    const rows = Math.ceil(news.length / g.c);
    const headH = headingHeight("News", "Latest updates", undefined);
    const h = M.sectionPad + headH + rows * (cardH + M.gap) - M.gap + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: LIGHT, radius: 0 }));
    let ny = y + M.sectionPad;
    ny += heading(ny, "News", "Latest updates", undefined, false);
    news.forEach((n, i) => {
      const cx = g.xOf(i);
      const cy = ny + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, cx, cy, g.cardW, cardH, { fill: TINT, radius: 16 }));
      const imgH = Math.round(cardH * 0.45);
      const src = n.image || photo(i + 3);
      if (src) add(image(pageId, src, cx, cy, g.cardW, imgH, 16));
      else add(icon(pageId, "Newspaper", cx + Math.round(g.cardW / 2 - 16), cy + Math.round(imgH / 2 - 16), 32, "#C9C1E4"));
      add(text(pageId, n.title, cx + 20, cy + imgH + 20, g.cardW - 40, { size: M.h3, weight: 700, color: INK }));
      if (n.body)
        add(
          text(pageId, n.body.slice(0, 150), cx + 20, cy + imgH + 20 + M.h3 + 16, g.cardW - 40, {
            size: M.small + 1,
            color: BODY,
          })
        );
    });
    y += h;
  }

  /* ======================================================= 13. CTA BAND */

  {
    const ctaTitle = profile.offer || `Ready to get started with ${name}?`;
    const titleH = textHeight(ctaTitle, COL, M.h2 - 4);
    const h = M.sectionPad + titleH + 26 + M.btnH + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: DEEP_2, radius: 0 }));
    add(rect(pageId, 0, y, W, h, { fill: DEEP, radius: 0, opacity: 0.45 }));
    add(circle(pageId, Math.round(W * 0.82), y + 20, device === "mobile" ? 110 : 180, "#FFFFFF", 0.06));
    add(
      text(pageId, ctaTitle, PAD, y + M.sectionPad, COL, {
        size: M.h2 - 4,
        weight: 800,
        color: ON_DARK,
        align: "center",
        height: titleH,
      })
    );
    const bw = M.stack ? COL : 240;
    add(
      pill(pageId, primaryCta?.label || "Get in touch", PAD + Math.round((COL - bw) / 2), y + M.sectionPad + titleH + 26, bw, M.btnH, {
        fill: "#FFFFFF",
        color: DEEP,
        action: primaryCta ? cloneAction(primaryCta.action) : anchor(hasContact ? "contact" : "hero"),
      })
    );
    y += h;
  }

  /* ====================================================== 14. CONTACT */

  if (hasContact) {
    const details: Array<[string, string, LayerAction | null]> = [];
    if (profile.phone)
      details.push(["Phone", profile.phone, { id: uid(), type: "call", payload: { phone: profile.phone } }]);
    if (profile.whatsapp)
      details.push(["WhatsApp", profile.whatsapp, { id: uid(), type: "whatsapp", payload: { phone: profile.whatsapp } }]);
    if (profile.email)
      details.push(["Email", profile.email, { id: uid(), type: "email", payload: { email: profile.email } }]);
    if (profile.address)
      details.push(["Visit us", profile.address, { id: uid(), type: "map", payload: { address: profile.address } }]);
    if (!details.length) details.push(["Contact", "Add your contact details in the editor", null]);

    const g = grid(details.length, device === "mobile" ? 1 : 2);
    const cardH = 118;
    const rows = Math.ceil(details.length / g.c);
    const headH = headingHeight("Contact", "Let's talk", profile.hours?.join(" · "));
    const h = M.sectionPad + headH + rows * (cardH + M.gap) - M.gap + M.sectionPad;
    add(rect(pageId, 0, y, W, h, { fill: TINT, radius: 0 }));
    let cy0 = y + M.sectionPad;
    cy0 += heading(cy0, "Contact", "Let's talk", profile.hours?.join(" · "), false);
    details.forEach(([label, value, action], i) => {
      const cx = g.xOf(i);
      const cy = cy0 + g.rowOf(i) * (cardH + M.gap);
      add(rect(pageId, cx, cy, g.cardW, cardH, { fill: LIGHT, radius: 16 }));
      add(circle(pageId, cx + 22, cy + 30, 52, A, 0.12));
      add(
        icon(
          pageId,
          label === "Phone" ? "Phone" : label === "Email" ? "Mail" : label === "WhatsApp" ? "MessageCircle" : "MapPin",
          cx + 36,
          cy + 44,
          24,
          A
        )
      );
      add(text(pageId, label, cx + 92, cy + 34, g.cardW - 112, { size: M.small, weight: 700, color: A }));
      const v = text(pageId, value, cx + 92, cy + 58, g.cardW - 112, { size: M.body, weight: 600, color: INK });
      v.action = action;
      add(v);
    });
    y += h;
  }

  /* ======================================================= 15. FOOTER */

  const footerH = device === "mobile" ? 380 : 348;
  add(rect(pageId, 0, y, W, footerH, { fill: FOOTER_BG, radius: 0 }));
  const logoS = device === "mobile" ? 48 : 58;
  if (profile.logoUrl) add(image(pageId, profile.logoUrl, Math.round(W / 2 - logoS / 2), y + 56, logoS, logoS, 12));
  else add(icon(pageId, "Sparkles", Math.round(W / 2 - 22), y + 60, 44, A));
  add(
    text(pageId, name, PAD, y + 56 + logoS + 20, COL, {
      size: M.h3 + 2,
      weight: 800,
      color: ON_DARK,
      align: "center",
    })
  );
  if (profile.tagline)
    add(
      text(pageId, profile.tagline.slice(0, 120), PAD, y + 56 + logoS + 20 + M.h3 + 26, COL, {
        size: M.small + 1,
        color: ON_DARK_MUTED,
        align: "center",
      })
    );

  const fNavY = y + 56 + logoS + 20 + M.h3 + (profile.tagline ? 62 : 34);
  const navPer = Math.round(COL / Math.max(1, navItems.length));
  navItems.forEach(([label, hash], i) => {
    const l = text(pageId, label, PAD + i * navPer, fNavY, navPer, {
      size: M.small,
      weight: 600,
      color: ON_DARK_MUTED,
      align: "center",
    });
    l.action = anchor(hash);
    add(l);
  });

  if (profile.socials?.length) {
    const per = Math.round(COL / profile.socials.slice(0, 6).length);
    profile.socials.slice(0, 6).forEach((s, i) => {
      const l = text(pageId, s.label, PAD + i * per, fNavY + 32, per, {
        size: M.small,
        weight: 700,
        color: A,
        align: "center",
      });
      l.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
      add(l);
    });
  }

  add(rect(pageId, PAD, y + footerH - 56, COL, 1, { fill: "#3A2E58", radius: 0 }));
  add(
    text(pageId, `© ${new Date().getFullYear()} ${name}. All rights reserved.`, PAD, y + footerH - 36, COL, {
      size: 12,
      color: ON_DARK_MUTED,
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
      color: LIGHT,
      size: { width: W, height: Math.round(y) },
      websitePage: true,
      websiteDevice: device,
      websiteTemplate: "dazzle",
      websiteProfile: profile,
    },
    layers: L,
  };
}
