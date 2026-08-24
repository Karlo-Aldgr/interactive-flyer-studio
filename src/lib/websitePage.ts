import { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import type { WebsiteProfile } from "@/lib/websiteProfile";

/**
 * Website page = one long, vertically scrolling page inside the EXISTING editor.
 * It is a normal FlyerPage (same layers, same canvas, same save/undo) marked with
 * `background.websitePage`, so nothing about flyer pages changes.
 *
 * The visual template is WaveX-inspired (themesindustry.com/html/wavex), but the
 * CONTENT is initialised from the CURRENT project (`WebsiteProfile`): its
 * onboarding info, business card, flyer text, flyer media and flyer actions.
 * Sections without real project data are omitted rather than filled with fake
 * business content. Everything generated is a normal, editable layer.
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
const W = WEBSITE_DEVICES.desktop;
const PAD = 120;
const COL = W - PAD * 2; // 1200

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

function text(
  pageId: string,
  value: string,
  x: number,
  y: number,
  width: number,
  opts: { size?: number; weight?: number; color?: string; align?: "left" | "center" | "right"; height?: number; italic?: boolean } = {}
): Layer {
  const size = opts.size ?? 18;
  const lines = Math.max(1, Math.ceil((value.length * size * 0.52) / width));
  return {
    ...base(pageId, "text"),
    position: { x, y },
    size: { width, height: opts.height ?? Math.round(lines * size * 1.45) },
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

function eyebrow(pageId: string, label: string, x: number, y: number, width: number, align: "left" | "center" = "left") {
  return text(pageId, label.toUpperCase(), x, y, width, { size: 14, weight: 700, color: ACCENT, align });
}

const cloneAction = (a: LayerAction): LayerAction => ({ ...a, id: uid(), payload: { ...a.payload } });

/**
 * Builds the Website page for the CURRENT project.
 * Only sections backed by real project data are generated.
 */
export function buildWebsitePage(flyerId: string, index: number, profile: WebsiteProfile): FlyerPage {
  Z = 0;
  const pageId = uid();
  const L: Layer[] = [];
  const add = (...l: Layer[]) => L.push(...l);
  let y = 0;

  const name = profile.businessName?.trim() || "Your business";
  const images = profile.images ?? [];
  const heroImage = profile.heroImage || images[0];
  const hasAbout = !!profile.description;
  const hasServices = (profile.services?.length ?? 0) > 0;
  const hasPortfolio = (profile.portfolio?.length ?? 0) > 0;
  const hasPricing = (profile.pricing?.length ?? 0) > 0;
  const hasContact = !!(profile.phone || profile.email || profile.address);
  const primaryCta = profile.ctas?.[0];
  const secondaryCta = profile.ctas?.[1];

  /* ---------------- Navigation ---------------- */
  const navItems: Array<[string, string]> = [["Home", "hero"]];
  if (hasAbout) navItems.push(["About", "about"]);
  if (hasServices) navItems.push(["Services", "services"]);
  if (hasPortfolio) navItems.push(["Work", "work"]);
  if (hasPricing) navItems.push(["Pricing", "pricing"]);
  if (hasContact) navItems.push(["Contact", "contact"]);

  add(rect(pageId, 0, 0, W, 92, { fill: SURFACE, radius: 0, opacity: 0.95 }));
  if (profile.logoUrl) {
    add(image(pageId, profile.logoUrl, PAD, 22, 48, 48, 12));
  } else {
    add(icon(pageId, "Sparkles", PAD, 26, 40, ACCENT));
  }
  add(text(pageId, name, PAD + 60, 34, 320, { size: 22, weight: 800 }));
  const navStart = W - PAD - 150 - 24 - navItems.length * 96;
  navItems.forEach(([label, hash], i) => {
    const l = text(pageId, label, navStart + i * 96, 38, 90, { size: 15, weight: 600, color: MUTED, align: "center" });
    l.action = anchor(hash);
    add(l);
  });
  if (hasContact) {
    add(button(pageId, "Contact us", W - PAD - 150, 26, 150, 42, { action: anchor("contact") }));
  }

  /* ---------------- Hero ---------------- */
  y = 92;
  const heroH = 700;
  add(rect(pageId, 0, y, W, heroH, { fill: BG, radius: 0 }));
  if (heroImage) {
    add(image(pageId, heroImage, 0, y, W, heroH, 0));
    add(rect(pageId, 0, y, W, heroH, { fill: "#050912", radius: 0, opacity: 0.7 }));
  }
  if (profile.tagline) add(eyebrow(pageId, profile.tagline.slice(0, 60), PAD, y + 150, 620));
  add(text(pageId, profile.headline || name, PAD, y + 190, 820, { size: 68, weight: 800, height: 220 }));
  if (profile.description) {
    add(text(pageId, profile.description.slice(0, 220), PAD, y + 430, 660, { size: 19, color: MUTED }));
  }
  let bx = PAD;
  if (primaryCta) {
    add(button(pageId, primaryCta.label, bx, y + 540, 230, 58, { action: cloneAction(primaryCta.action) }));
    bx += 250;
  } else if (hasContact) {
    add(button(pageId, "Get in touch", bx, y + 540, 210, 58, { action: anchor("contact") }));
    bx += 230;
  }
  if (secondaryCta) {
    add(
      button(pageId, secondaryCta.label, bx, y + 540, 220, 58, {
        fill: "#FFFFFF",
        color: "#0B1220",
        action: cloneAction(secondaryCta.action),
      })
    );
  }
  y += heroH;

  /* ---------------- About ---------------- */
  if (hasAbout) {
    const aboutImg = images[1] || images[0];
    add(rect(pageId, 0, y, W, 560, { fill: BG, radius: 0 }));
    if (aboutImg) add(image(pageId, aboutImg, PAD, y + 80, 540, 400, 28));
    const tx = aboutImg ? 720 : PAD;
    const tw = aboutImg ? 600 : COL;
    add(eyebrow(pageId, "About", tx, y + 100, tw));
    add(text(pageId, `About ${name}`, tx, y + 132, tw, { size: 42, weight: 800, height: 120 }));
    add(text(pageId, profile.description!, tx, y + 270, tw - 20, { size: 17, color: MUTED }));
    y += 560;
  }

  /* ---------------- Services (from project products / menu items) ---------------- */
  if (hasServices) {
    const rows = Math.ceil(profile.services.length / 3);
    const h = 200 + rows * 220;
    add(rect(pageId, 0, y, W, h, { fill: SURFACE, radius: 0 }));
    add(eyebrow(pageId, "Services", PAD, y + 80, COL, "center"));
    add(text(pageId, "What we offer", PAD, y + 112, COL, { size: 42, weight: 800, align: "center", height: 70 }));
    profile.services.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = PAD + col * 400;
      const cy = y + 200 + row * 220;
      add(rect(pageId, x, cy, 370, 190, { fill: SURFACE_2, radius: 22 }));
      if (s.image) add(image(pageId, s.image, x + 32, cy + 26, 56, 56, 14));
      else add(icon(pageId, "Sparkles", x + 32, cy + 26, 40));
      add(text(pageId, s.title, x + 32, cy + 96, 300, { size: 20, weight: 700 }));
      if (s.body) add(text(pageId, s.body.slice(0, 140), x + 32, cy + 128, 306, { size: 14, color: MUTED }));
    });
    y += h;
  }

  /* ---------------- Work / gallery (from project media) ---------------- */
  if (hasPortfolio) {
    const rows = Math.ceil(profile.portfolio.length / 2);
    const h = 200 + rows * 330;
    add(rect(pageId, 0, y, W, h, { fill: BG, radius: 0 }));
    add(eyebrow(pageId, "Our work", PAD, y + 70, COL, "center"));
    add(text(pageId, "Gallery", PAD, y + 102, COL, { size: 42, weight: 800, align: "center", height: 70 }));
    profile.portfolio.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = PAD + col * 620;
      const cy = y + 190 + row * 330;
      if (p.image) add(image(pageId, p.image, x, cy, 580, 220, 22));
      else add(rect(pageId, x, cy, 580, 220, { fill: SURFACE_2, radius: 22 }));
      if (p.category) add(text(pageId, p.category.toUpperCase(), x, cy + 236, 300, { size: 12, weight: 700, color: ACCENT }));
      add(text(pageId, p.title, x, cy + 256, 480, { size: 22, weight: 700 }));
      if (p.description) add(text(pageId, p.description.slice(0, 160), x, cy + 288, 560, { size: 14, color: MUTED }));
    });
    y += h;
  }

  /* ---------------- Pricing (from project products) ---------------- */
  if (hasPricing) {
    const h = 640;
    add(rect(pageId, 0, y, W, h, { fill: SURFACE, radius: 0 }));
    add(eyebrow(pageId, "Pricing", PAD, y + 70, COL, "center"));
    add(text(pageId, "Our prices", PAD, y + 102, COL, { size: 42, weight: 800, align: "center", height: 70 }));
    profile.pricing.forEach((plan, i) => {
      const x = PAD + i * 400;
      const cy = y + 200;
      add(rect(pageId, x, cy, 370, 340, { fill: SURFACE_2, radius: 24 }));
      add(text(pageId, plan.name, x + 32, cy + 32, 300, { size: 20, weight: 700, color: "#FFFFFF" }));
      add(text(pageId, plan.price, x + 32, cy + 66, 300, { size: 36, weight: 800, color: ACCENT }));
      plan.features.forEach((f, fi) => {
        add(text(pageId, `•  ${f}`, x + 32, cy + 140 + fi * 34, 300, { size: 15, color: MUTED }));
      });
      if (primaryCta) {
        add(
          button(pageId, primaryCta.label, x + 32, cy + 262, 306, 52, {
            action: cloneAction(primaryCta.action),
          })
        );
      }
    });
    y += h;
  }

  /* ---------------- Contact ---------------- */
  if (hasContact) {
    const h = 560;
    add(rect(pageId, 0, y, W, h, { fill: BG, radius: 0 }));
    add(eyebrow(pageId, "Contact", PAD, y + 80, 520));
    add(text(pageId, `Get in touch with ${name}`, PAD, y + 112, 560, { size: 40, weight: 800, height: 120 }));

    const rows: Array<[string, string]> = [];
    if (profile.phone) rows.push(["Phone", profile.phone]);
    if (profile.email) rows.push(["Mail", profile.email]);
    if (profile.address) rows.push(["MapPin", profile.address]);
    rows.forEach(([ic, value], i) => {
      const cy = y + 250 + i * 60;
      add(icon(pageId, ic, PAD, cy, 26, ACCENT));
      add(text(pageId, value, PAD + 44, cy + 2, 520, { size: 16 }));
    });

    let cx = PAD;
    if (profile.phone) {
      add(
        button(pageId, "Call us", cx, y + 450, 160, 52, {
          action: { id: uid(), type: "call", payload: { phone: profile.phone } },
        })
      );
      cx += 180;
    }
    if (profile.address) {
      add(
        button(pageId, "Get directions", cx, y + 450, 200, 52, {
          fill: ACCENT_2,
          action: { id: uid(), type: "map", payload: { mapAddress: profile.address, mapProvider: "auto" } },
        })
      );
    }

    // Message form — collects leads into the existing form submissions flow
    add(rect(pageId, 760, y + 90, 560, 380, { fill: SURFACE, radius: 26 }));
    add(text(pageId, "Send us a message", 800, y + 126, 480, { size: 22, weight: 700 }));
    ["Your name", "Email address", "Message"].forEach((label, i) => {
      const fy = y + 180 + i * 74;
      const hh = i === 2 ? 96 : 52;
      add(rect(pageId, 800, fy, 480, hh, { fill: SURFACE_2, radius: 12 }));
      add(text(pageId, label, 818, fy + 17, 440, { size: 15, color: MUTED }));
    });
    add(
      button(pageId, "Send message", 800, y + 400, 480, 54, {
        radius: 14,
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
  const footerH = 300;
  add(rect(pageId, 0, y, W, footerH, { fill: SURFACE, radius: 0 }));
  if (profile.logoUrl) add(image(pageId, profile.logoUrl, PAD, y + 50, 44, 44, 10));
  else add(icon(pageId, "Sparkles", PAD, y + 54, 36, ACCENT));
  add(text(pageId, name, PAD + 56, y + 60, 300, { size: 20, weight: 800 }));
  if (profile.description) {
    add(text(pageId, profile.description.slice(0, 140), PAD, y + 116, 380, { size: 14, color: MUTED }));
  }
  add(text(pageId, "Navigate", 620, y + 56, 200, { size: 15, weight: 700 }));
  navItems.forEach(([label, hash], i) => {
    const l = text(pageId, label, 620, y + 90 + i * 28, 180, { size: 14, color: MUTED });
    l.action = anchor(hash);
    add(l);
  });
  const contactLines = [profile.phone, profile.email, profile.address].filter(Boolean) as string[];
  if (contactLines.length) {
    add(text(pageId, "Contact", 900, y + 56, 240, { size: 15, weight: 700 }));
    contactLines.forEach((line, i) => {
      add(text(pageId, line, 900, y + 90 + i * 28, 300, { size: 14, color: MUTED }));
    });
  }
  if (profile.socials.length) {
    add(text(pageId, "Follow", 1200, y + 56, 200, { size: 15, weight: 700 }));
    profile.socials.slice(0, 4).forEach((s, i) => {
      const l = text(pageId, s.label, 1200, y + 90 + i * 28, 180, { size: 14, color: MUTED });
      l.action = { id: uid(), type: "open_url", payload: { url: s.url, newTab: true } };
      add(l);
    });
  }
  add(rect(pageId, PAD, y + 230, COL, 1, { fill: "#243049", radius: 0 }));
  add(
    text(pageId, `© ${new Date().getFullYear()} ${name}. All rights reserved.`, PAD, y + 256, COL, {
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
      color: BG,
      size: { width: W, height: y },
      websitePage: true,
      websiteDevice: "desktop",
    },
    layers: L,
  };
}
