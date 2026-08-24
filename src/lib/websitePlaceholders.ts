import type { WebsiteProfile } from "@/lib/websiteProfile";

/**
 * WaveX structure is FIXED. Data availability never removes a section.
 *
 * Real client / project / flyer data always wins. Anything missing is filled
 * with obvious Lorem Ipsum placeholders (or `00` / `$00`) so the client can see
 * exactly what still needs replacing in the editor. Nothing is invented.
 */

export const LOREM_NAME = "Lorem Ipsum";
export const LOREM_SHORT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
export const LOREM_LONG =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
export const LOREM_STAT = "00";
export const LOREM_PRICE = "$00";

const has = (v?: string | null) => !!(v && v.trim());

/** Returns a profile where every WaveX section has content to render. */
export function withWavexPlaceholders(input: WebsiteProfile): WebsiteProfile {
  const p: WebsiteProfile = {
    ...input,
    images: [...(input.images ?? [])],
    services: [...(input.services ?? [])],
    pricing: [...(input.pricing ?? [])],
    portfolio: [...(input.portfolio ?? [])],
    socials: [...(input.socials ?? [])],
    ctas: [...(input.ctas ?? [])],
    team: [...(input.team ?? [])],
    stats: [...(input.stats ?? [])],
    testimonials: [...(input.testimonials ?? [])],
    news: [...(input.news ?? [])],
  };

  /* identity / hero */
  if (!has(p.businessName)) p.businessName = LOREM_NAME;
  if (!has(p.headline)) p.headline = LOREM_NAME;
  if (!has(p.tagline)) p.tagline = LOREM_SHORT;
  if (!has(p.description)) p.description = LOREM_LONG;

  /* intro highlights + expertise (4 items) */
  while (p.services.length < 4) {
    p.services.push({ title: LOREM_NAME, body: LOREM_SHORT });
  }
  p.services = p.services.map((s) => ({ ...s, title: has(s.title) ? s.title : LOREM_NAME, body: has(s.body) ? s.body : LOREM_SHORT }));

  /* team */
  while (p.team.length < 2) {
    p.team.push({ name: LOREM_NAME, role: LOREM_NAME, body: LOREM_SHORT });
  }
  p.team = p.team.map((m) => ({
    ...m,
    name: has(m.name) ? m.name : LOREM_NAME,
    role: has(m.role) ? m.role : LOREM_NAME,
    body: has(m.body) ? m.body : LOREM_SHORT,
  }));

  /* statistics — always four, `00` when unknown */
  const statLabels = ["Lorem Ipsum", "Lorem Ipsum", "Lorem Ipsum", "Lorem Ipsum"];
  while (p.stats.length < 4) {
    p.stats.push({ value: LOREM_STAT, label: statLabels[p.stats.length] });
  }
  p.stats = p.stats.slice(0, 4).map((s) => ({
    value: has(s.value) ? s.value : LOREM_STAT,
    label: has(s.label) ? s.label : LOREM_NAME,
  }));

  /* portfolio / our work */
  while (p.portfolio.length < 4) {
    p.portfolio.push({ title: LOREM_NAME, description: LOREM_SHORT });
  }
  p.portfolio = p.portfolio.map((w) => ({
    ...w,
    title: has(w.title) ? w.title : LOREM_NAME,
    description: has(w.description) ? w.description : LOREM_SHORT,
  }));

  /* testimonials */
  if (!p.testimonials.length) p.testimonials.push({ name: LOREM_NAME, body: LOREM_LONG });
  p.testimonials = p.testimonials.map((t) => ({
    ...t,
    name: has(t.name) ? t.name : LOREM_NAME,
    body: has(t.body) ? t.body : LOREM_LONG,
  }));

  /* pricing / packages — always three */
  while (p.pricing.length < 3) {
    p.pricing.push({ name: LOREM_NAME, price: LOREM_PRICE, features: [LOREM_SHORT, LOREM_SHORT] });
  }
  p.pricing = p.pricing.slice(0, 3).map((pl) => ({
    name: has(pl.name) ? pl.name : LOREM_NAME,
    price: has(pl.price) ? pl.price : LOREM_PRICE,
    features: pl.features?.length ? pl.features : [LOREM_SHORT],
  }));

  /* news & events */
  while (p.news.length < 2) {
    p.news.push({ title: LOREM_NAME, body: LOREM_LONG });
  }
  p.news = p.news.map((n) => ({
    ...n,
    title: has(n.title) ? n.title : LOREM_NAME,
    body: has(n.body) ? n.body : LOREM_LONG,
  }));

  /* contact / footer — never fabricate a real-looking number or address */
  if (!has(p.phone)) p.phone = LOREM_NAME;
  if (!has(p.email)) p.email = LOREM_NAME;
  if (!has(p.address)) p.address = LOREM_NAME;
  if (!p.hours?.length) p.hours = [LOREM_SHORT];

  return p;
}

/** Placeholder client/partner names for the WaveX "Our clients" band. */
export function placeholderClients(count = 5): string[] {
  return Array.from({ length: count }, () => LOREM_NAME);
}
