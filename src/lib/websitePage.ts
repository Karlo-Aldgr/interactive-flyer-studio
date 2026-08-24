import { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";

/**
 * Website page = one long, vertically scrolling page inside the EXISTING editor.
 * It is a normal FlyerPage (same layers, same canvas, same save/undo) marked with
 * `background.websitePage`, so nothing about flyer pages changes.
 *
 * The initial template is a WaveX-inspired (themesindustry.com/html/wavex) dark
 * agency layout consolidated into a single scrolling page.
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

function image(pageId: string, seed: string, x: number, y: number, width: number, height: number, radius = 20): Layer {
  return {
    ...base(pageId, "image"),
    position: { x, y },
    size: { width, height },
    style: { cornerRadius: radius },
    content: { src: `https://picsum.photos/seed/${seed}/${Math.round(width)}/${Math.round(height)}` },
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

/** Builds the full WaveX-inspired website page. */
export function buildWebsitePage(flyerId: string, index: number): FlyerPage {
  Z = 0;
  const pageId = uid();
  const L: Layer[] = [];
  const add = (...l: Layer[]) => L.push(...l);
  let y = 0;

  /* ---------------- Navigation ---------------- */
  add(rect(pageId, 0, 0, W, 92, { fill: SURFACE, radius: 0, opacity: 0.95 }));
  add(icon(pageId, "Waves", PAD, 26, 40, ACCENT));
  add(text(pageId, "WaveX Studio", PAD + 52, 34, 260, { size: 22, weight: 800 }));
  const navItems: Array<[string, string]> = [
    ["Home", "hero"],
    ["About", "about"],
    ["Services", "services"],
    ["Work", "work"],
    ["Pricing", "pricing"],
    ["Contact", "contact"],
  ];
  navItems.forEach(([label, hash], i) => {
    const nx = 620 + i * 96;
    const l = text(pageId, label, nx, 38, 90, { size: 15, weight: 600, color: MUTED, align: "center" });
    l.action = anchor(hash);
    add(l);
  });
  add(button(pageId, "Let's Talk", W - PAD - 150, 26, 150, 42, { action: anchor("contact") }));

  /* ---------------- Hero ---------------- */
  y = 92;
  add(rect(pageId, 0, y, W, 760, { fill: BG, radius: 0 }));
  add(image(pageId, "wavex-hero", 0, y, W, 760, 0));
  add(rect(pageId, 0, y, W, 760, { fill: "#050912", radius: 0, opacity: 0.72 }));
  add(eyebrow(pageId, "Digital Experience Agency", PAD, y + 150, 520));
  add(text(pageId, "We build brands that ride the next wave", PAD, y + 186, 820, { size: 76, weight: 800, height: 240 }));
  add(
    text(
      pageId,
      "Strategy, design and technology for ambitious companies. One team, one long-term partnership, measurable growth.",
      PAD,
      y + 440,
      660,
      { size: 19, color: MUTED }
    )
  );
  add(button(pageId, "Start a project", PAD, y + 540, 210, 58, { action: anchor("contact") }));
  add(
    button(pageId, "View our work", PAD + 230, y + 540, 200, 58, {
      fill: "#FFFFFF",
      color: "#0B1220",
      action: anchor("work"),
    })
  );
  y += 760;

  /* ---------------- About ---------------- */
  add(rect(pageId, 0, y, W, 620, { fill: BG, radius: 0 }));
  add(image(pageId, "wavex-about", PAD, y + 90, 540, 440, 28));
  add(eyebrow(pageId, "About us", 720, y + 110, 400));
  add(text(pageId, "A studio built around craft and clarity", 720, y + 142, 600, { size: 44, weight: 800, height: 130 }));
  add(
    text(
      pageId,
      "Since 2012 we have partnered with founders and marketing teams to turn complex ideas into simple, beautiful products. Every engagement starts with research and ends with results you can measure.",
      720,
      y + 288,
      580,
      { size: 17, color: MUTED }
    )
  );
  [
    ["12+", "Years of practice"],
    ["96%", "Client retention"],
  ].forEach(([n, label], i) => {
    const x = 720 + i * 300;
    add(text(pageId, n, x, y + 410, 240, { size: 40, weight: 800, color: ACCENT }));
    add(text(pageId, label, x, y + 462, 240, { size: 15, color: MUTED }));
  });
  y += 620;

  /* ---------------- Services / Expertise ---------------- */
  add(rect(pageId, 0, y, W, 700, { fill: SURFACE, radius: 0 }));
  add(eyebrow(pageId, "Services", PAD, y + 90, COL, "center"));
  add(text(pageId, "Expertise that moves the needle", PAD, y + 122, COL, { size: 44, weight: 800, align: "center", height: 70 }));
  const services: Array<[string, string, string]> = [
    ["PenTool", "Brand & Identity", "Positioning, visual systems and guidelines that make you unmistakable."],
    ["Layout", "Web & Product Design", "Conversion-focused websites and product interfaces designed to scale."],
    ["Code", "Development", "Fast, accessible builds on modern stacks with clean handover."],
    ["Megaphone", "Digital Marketing", "Campaigns, content and paid media tuned for measurable pipeline."],
    ["BarChart3", "Analytics & CRO", "Instrumentation, testing and iteration to lift every funnel step."],
    ["Sparkles", "Motion & 3D", "Animation and immersive visuals that give your story momentum."],
  ];
  services.forEach(([ic, title, body], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = PAD + col * 400;
    const cy = y + 230 + row * 220;
    add(rect(pageId, x, cy, 370, 190, { fill: SURFACE_2, radius: 22 }));
    add(icon(pageId, ic, x + 32, cy + 30, 40));
    add(text(pageId, title, x + 32, cy + 84, 300, { size: 20, weight: 700 }));
    add(text(pageId, body, x + 32, cy + 116, 306, { size: 14, color: MUTED }));
  });
  y += 700;

  /* ---------------- Team ---------------- */
  add(rect(pageId, 0, y, W, 620, { fill: BG, radius: 0 }));
  add(eyebrow(pageId, "Our team", PAD, y + 80, COL, "center"));
  add(text(pageId, "The people behind the work", PAD, y + 112, COL, { size: 44, weight: 800, align: "center", height: 70 }));
  const team: Array<[string, string, string]> = [
    ["Ava Mitchell", "Creative Director", "Leads brand strategy and art direction."],
    ["Noah Bennett", "Head of Design", "Turns research into interfaces people love."],
    ["Lena Ortiz", "Lead Engineer", "Builds fast, resilient front-end systems."],
    ["Marcus Hale", "Growth Lead", "Owns performance marketing and CRO."],
  ];
  team.forEach(([name, role, bio], i) => {
    const x = PAD + i * 300;
    add(image(pageId, `wavex-team-${i}`, x, y + 210, 270, 250, 22));
    add(text(pageId, name, x, y + 478, 260, { size: 19, weight: 700 }));
    add(text(pageId, role, x, y + 504, 260, { size: 14, color: ACCENT }));
    add(text(pageId, bio, x, y + 528, 262, { size: 13, color: MUTED }));
  });
  y += 620;

  /* ---------------- Statistics ---------------- */
  add(rect(pageId, 0, y, W, 300, { fill: ACCENT, radius: 0 }));
  const stats: Array<[string, string, string]> = [
    ["480+", "Projects delivered", "Across 21 countries"],
    ["120", "Happy clients", "From startup to enterprise"],
    ["38", "Awards won", "Design and innovation"],
    ["24/7", "Support", "Always-on partnership"],
  ];
  stats.forEach(([n, label, sub], i) => {
    const x = PAD + i * 300;
    add(text(pageId, n, x, y + 90, 270, { size: 52, weight: 800, color: "#FFFFFF", align: "center" }));
    add(text(pageId, label, x, y + 156, 270, { size: 17, weight: 700, color: "#FFFFFF", align: "center" }));
    add(text(pageId, sub, x, y + 184, 270, { size: 14, color: "#FFE8DF", align: "center" }));
  });
  y += 300;

  /* ---------------- Portfolio / Our Work ---------------- */
  add(rect(pageId, 0, y, W, 900, { fill: BG, radius: 0 }));
  add(eyebrow(pageId, "Our work", PAD, y + 80, COL, "center"));
  add(text(pageId, "Selected projects", PAD, y + 112, COL, { size: 44, weight: 800, align: "center", height: 70 }));
  const work: Array<[string, string, string]> = [
    ["Northwind Bank", "Fintech", "A calm, trustworthy banking experience rebuilt from scratch."],
    ["Kite Athletics", "E-commerce", "A performance store that lifted conversion by 41%."],
    ["Solace Health", "Healthcare", "Patient portal design with accessibility at the core."],
    ["Orbit Labs", "SaaS", "Brand and marketing site for an AI infrastructure startup."],
  ];
  work.forEach(([title, cat, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAD + col * 620;
    const cy = y + 210 + row * 330;
    add(image(pageId, `wavex-work-${i}`, x, cy, 580, 220, 22));
    add(text(pageId, cat.toUpperCase(), x, cy + 236, 300, { size: 12, weight: 700, color: ACCENT }));
    add(text(pageId, title, x, cy + 256, 420, { size: 24, weight: 700 }));
    add(text(pageId, desc, x, cy + 288, 560, { size: 14, color: MUTED }));
    const link = text(pageId, "View project →", x + 440, cy + 256, 140, { size: 14, weight: 700, color: ACCENT_2 });
    link.action = { id: uid(), type: "open_url", payload: { url: "https://example.com", newTab: true } };
    add(link);
  });
  y += 900;

  /* ---------------- Featured Work ---------------- */
  add(rect(pageId, 0, y, W, 560, { fill: SURFACE, radius: 0 }));
  add(image(pageId, "wavex-featured", 720, y + 80, 600, 400, 26));
  add(eyebrow(pageId, "Featured", PAD, y + 130, 500));
  add(text(pageId, "Rebuilding a global travel platform", PAD, y + 162, 540, { size: 40, weight: 800, height: 120 }));
  add(
    text(
      pageId,
      "A twelve-month engagement covering research, design system, front-end build and continuous optimisation — shipping a 2.4x faster booking flow.",
      PAD,
      y + 300,
      520,
      { size: 17, color: MUTED }
    )
  );
  add(button(pageId, "Read the case study", PAD, y + 400, 230, 56, { fill: ACCENT_2 }));
  y += 560;

  /* ---------------- Testimonials ---------------- */
  add(rect(pageId, 0, y, W, 520, { fill: BG, radius: 0 }));
  add(eyebrow(pageId, "Testimonials", PAD, y + 70, COL, "center"));
  add(text(pageId, "What clients say", PAD, y + 102, COL, { size: 44, weight: 800, align: "center", height: 70 }));
  const quotes: Array<[string, string, string]> = [
    ["Sara Whitfield", "CMO, Northwind", "They understood our business in week one and never slowed down. Best partner we've had."],
    ["Daniel Cruz", "Founder, Kite", "Our store finally feels like our brand — and the numbers followed immediately."],
    ["Priya Raman", "VP Product, Solace", "Thoughtful, accessible design delivered on time, every single sprint."],
  ];
  quotes.forEach(([name, role, quote], i) => {
    const x = PAD + i * 400;
    const cy = y + 200;
    add(rect(pageId, x, cy, 370, 230, { fill: SURFACE_2, radius: 22 }));
    add(text(pageId, `“${quote}”`, x + 30, cy + 32, 310, { size: 15, color: TEXT, italic: true }));
    add(image(pageId, `wavex-client-${i}`, x + 30, cy + 150, 48, 48, 24));
    add(text(pageId, name, x + 90, cy + 156, 240, { size: 15, weight: 700 }));
    add(text(pageId, role, x + 90, cy + 178, 240, { size: 13, color: MUTED }));
  });
  y += 520;

  /* ---------------- Pricing ---------------- */
  add(rect(pageId, 0, y, W, 700, { fill: SURFACE, radius: 0 }));
  add(eyebrow(pageId, "Pricing", PAD, y + 80, COL, "center"));
  add(text(pageId, "Simple, transparent plans", PAD, y + 112, COL, { size: 44, weight: 800, align: "center", height: 70 }));
  const plans: Array<[string, string, string[]]> = [
    ["Starter", "$1,200/mo", ["Brand refresh", "5-page website", "Monthly reporting", "Email support"]],
    ["Growth", "$3,400/mo", ["Everything in Starter", "Design system", "CRO experiments", "Dedicated designer"]],
    ["Scale", "$6,800/mo", ["Everything in Growth", "Full product team", "Motion & 3D", "Priority 24/7 support"]],
  ];
  plans.forEach(([name, price, features], i) => {
    const x = PAD + i * 400;
    const cy = y + 210;
    const featured = i === 1;
    add(rect(pageId, x, cy, 370, 400, { fill: featured ? ACCENT : SURFACE_2, radius: 24 }));
    add(text(pageId, name, x + 32, cy + 32, 300, { size: 20, weight: 700, color: "#FFFFFF" }));
    add(text(pageId, price, x + 32, cy + 66, 300, { size: 38, weight: 800, color: "#FFFFFF" }));
    features.forEach((f, fi) => {
      add(text(pageId, `•  ${f}`, x + 32, cy + 140 + fi * 34, 300, { size: 15, color: featured ? "#FFF1EA" : MUTED }));
    });
    add(
      button(pageId, "Choose plan", x + 32, cy + 300, 306, 52, {
        fill: featured ? "#FFFFFF" : ACCENT,
        color: featured ? "#0B1220" : "#FFFFFF",
        action: anchor("contact"),
      })
    );
  });
  y += 700;

  /* ---------------- Clients ---------------- */
  add(rect(pageId, 0, y, W, 300, { fill: BG, radius: 0 }));
  add(text(pageId, "Trusted by teams worldwide", PAD, y + 70, COL, { size: 24, weight: 700, align: "center" }));
  ["Northwind", "Kite", "Solace", "Orbit", "Meridian", "Lumen"].forEach((name, i) => {
    const x = PAD + i * 200;
    add(rect(pageId, x, y + 140, 170, 80, { fill: SURFACE, radius: 16 }));
    add(text(pageId, name, x, y + 170, 170, { size: 16, weight: 700, color: MUTED, align: "center" }));
  });
  y += 300;

  /* ---------------- News & Events ---------------- */
  add(rect(pageId, 0, y, W, 620, { fill: SURFACE, radius: 0 }));
  add(eyebrow(pageId, "News & events", PAD, y + 80, COL, "center"));
  add(text(pageId, "Latest from the studio", PAD, y + 112, COL, { size: 44, weight: 800, align: "center", height: 70 }));
  const news: Array<[string, string, string]> = [
    ["Design systems that survive growth", "12 March 2026", "How we keep component libraries usable after launch."],
    ["We're speaking at WaveConf", "28 April 2026", "Join our creative director for a session on motion craft."],
    ["Inside our research sprint", "09 June 2026", "A week-by-week look at how we de-risk new products."],
  ];
  news.forEach(([title, date, desc], i) => {
    const x = PAD + i * 400;
    const cy = y + 200;
    add(rect(pageId, x, cy, 370, 340, { fill: SURFACE_2, radius: 22 }));
    add(image(pageId, `wavex-news-${i}`, x, cy, 370, 160, 22));
    add(text(pageId, date, x + 26, cy + 180, 300, { size: 13, weight: 700, color: ACCENT }));
    add(text(pageId, title, x + 26, cy + 204, 320, { size: 19, weight: 700 }));
    add(text(pageId, desc, x + 26, cy + 256, 320, { size: 14, color: MUTED }));
  });
  y += 620;

  /* ---------------- Contact ---------------- */
  add(rect(pageId, 0, y, W, 700, { fill: BG, radius: 0 }));
  add(eyebrow(pageId, "Contact", PAD, y + 90, 520));
  add(text(pageId, "Let's build your next wave", PAD, y + 122, 540, { size: 44, weight: 800, height: 130 }));
  add(
    text(pageId, "Tell us about your project and we'll come back within one business day.", PAD, y + 262, 500, {
      size: 17,
      color: MUTED,
    })
  );
  const contactRows: Array<[string, string, string]> = [
    ["Phone", "+1 (555) 018-2244", "Phone"],
    ["Mail", "hello@wavexstudio.com", "Mail"],
    ["MapPin", "48 Harbour Street, Suite 500, New York", "MapPin"],
  ];
  contactRows.forEach(([ic, value], i) => {
    const cy = y + 340 + i * 70;
    add(icon(pageId, ic, PAD, cy, 26, ACCENT));
    add(text(pageId, value, PAD + 44, cy + 2, 480, { size: 16 }));
  });
  const callBtn = button(pageId, "Call us", PAD, y + 570, 160, 52, {
    action: { id: uid(), type: "call", payload: { phone: "+15550182244" } },
  });
  add(callBtn);
  const mapBtn = button(pageId, "Get directions", PAD + 180, y + 570, 200, 52, {
    fill: ACCENT_2,
    action: { id: uid(), type: "map", payload: { mapAddress: "48 Harbour Street, New York", mapProvider: "auto" } },
  });
  add(mapBtn);

  // Contact form card
  add(rect(pageId, 760, y + 110, 560, 480, { fill: SURFACE, radius: 26 }));
  add(text(pageId, "Send us a message", 800, y + 150, 480, { size: 22, weight: 700 }));
  ["Your name", "Email address", "Company", "Project details"].forEach((label, i) => {
    const fy = y + 200 + i * 74;
    const h = i === 3 ? 96 : 52;
    add(rect(pageId, 800, fy, 480, h, { fill: SURFACE_2, radius: 12 }));
    add(text(pageId, label, 818, fy + (i === 3 ? 18 : 17), 440, { size: 15, color: MUTED }));
  });
  add(
    button(pageId, "Send message", 800, y + 512, 480, 54, {
      radius: 14,
      action: {
        id: uid(),
        type: "form",
        payload: { title: "Contact us", fields: ["name", "email", "phone"], successMessage: "Thanks — we'll be in touch." },
      },
    })
  );
  y += 700;

  /* ---------------- Footer ---------------- */
  add(rect(pageId, 0, y, W, 360, { fill: SURFACE, radius: 0 }));
  add(icon(pageId, "Waves", PAD, y + 60, 36, ACCENT));
  add(text(pageId, "WaveX Studio", PAD + 48, y + 66, 280, { size: 20, weight: 800 }));
  add(
    text(pageId, "A digital experience studio helping ambitious brands design, build and grow.", PAD, y + 116, 380, {
      size: 14,
      color: MUTED,
    })
  );
  add(text(pageId, "Navigate", 620, y + 62, 200, { size: 15, weight: 700 }));
  navItems.forEach(([label, hash], i) => {
    const l = text(pageId, label, 620, y + 96 + i * 30, 180, { size: 14, color: MUTED });
    l.action = anchor(hash);
    add(l);
  });
  add(text(pageId, "Contact", 900, y + 62, 240, { size: 15, weight: 700 }));
  ["+1 (555) 018-2244", "hello@wavexstudio.com", "48 Harbour Street, Suite 500", "New York, NY 10004"].forEach((line, i) => {
    add(text(pageId, line, 900, y + 96 + i * 30, 300, { size: 14, color: MUTED }));
  });
  add(text(pageId, "Follow", 1220, y + 62, 200, { size: 15, weight: 700 }));
  ["Instagram", "Linkedin", "Twitter"].forEach((name, i) => {
    add(icon(pageId, name, 1220 + i * 46, y + 96, 24, MUTED));
  });
  add(rect(pageId, PAD, y + 280, COL, 1, { fill: "#243049", radius: 0 }));
  add(
    text(pageId, `© ${new Date().getFullYear()} WaveX Studio. All rights reserved.`, PAD, y + 306, COL, {
      size: 13,
      color: MUTED,
      align: "center",
    })
  );
  y += 360;

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
