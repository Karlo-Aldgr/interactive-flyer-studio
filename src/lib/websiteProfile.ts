import type { Flyer, FlyerPage, Layer, LayerAction } from "@/types/flyer";
import type { OnboardingSubmission } from "@/lib/onboarding";
import type { BizadRecord } from "@/lib/bizad";

/**
 * Project-specific content used to initialise a Website page.
 *
 * Everything here is derived from the CURRENT project only:
 *  - the flyer record (title)
 *  - the flyer's existing pages/layers (text, images, actions)
 *  - the project's onboarding submission (business info)
 *  - the project's digital business card record
 *
 * Nothing is invented. Missing values stay undefined so the website builder can
 * hide the matching section instead of writing fake business content.
 */
export interface WebsiteProfile {
  businessName?: string;
  headline?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  heroImage?: string;
  images: string[];
  services: { title: string; body?: string; image?: string }[];
  pricing: { name: string; price: string; features: string[] }[];
  portfolio: { title: string; category?: string; description?: string; image?: string }[];
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  socials: { label: string; url: string }[];
  ctas: { label: string; action: LayerAction }[];
}

const clean = (v?: string | null) => {
  const s = (v ?? "").toString().replace(/\s+/g, " ").trim();
  return s ? s : undefined;
};

const isHttp = (v?: string | null) => !!v && /^(https?:)?\/\//i.test(v.trim());

function pushUnique(list: string[], v?: string | null) {
  const s = clean(v);
  if (s && isHttp(s) && !list.includes(s)) list.push(s);
}

function socialLabel(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("facebook")) return "Facebook";
  if (u.includes("instagram")) return "Instagram";
  if (u.includes("tiktok")) return "TikTok";
  if (u.includes("linkedin")) return "LinkedIn";
  if (u.includes("youtube")) return "YouTube";
  if (u.includes("x.com") || u.includes("twitter")) return "X";
  return "Website";
}

/** Orders layers the way a reader would see them: page order, then top-to-bottom. */
function orderedLayers(pages: FlyerPage[]): Layer[] {
  const out: Layer[] = [];
  [...pages]
    .filter((p) => !p.background?.websitePage)
    .sort((a, b) => a.index - b.index)
    .forEach((p) => {
      [...p.layers].sort((a, b) => a.position.y - b.position.y).forEach((l) => out.push(l));
    });
  return out;
}

export function buildWebsiteProfile(args: {
  flyer: Flyer | null;
  pages: FlyerPage[];
  onboarding?: OnboardingSubmission | null;
  bizad?: BizadRecord | null;
}): WebsiteProfile {
  const { flyer, pages, onboarding, bizad } = args;
  const layers = orderedLayers(pages);

  const profile: WebsiteProfile = {
    images: [],
    services: [],
    pricing: [],
    portfolio: [],
    socials: [],
    ctas: [],
  };

  /* ---- identity / contact from onboarding + business card (most reliable) ---- */
  profile.businessName =
    clean(onboarding?.business_name) || clean(bizad?.business_name) || clean(flyer?.title);
  profile.tagline = clean(onboarding?.business_slogan);
  profile.description = clean(onboarding?.business_description) || clean(bizad?.about_text);
  profile.logoUrl = clean(onboarding?.logo_url) || clean(bizad?.logo_url);
  profile.phone = clean(onboarding?.phone) || clean(bizad?.phone);
  profile.email = clean(onboarding?.email) || clean(bizad?.email);
  profile.address = clean(onboarding?.business_address) || clean(bizad?.address);
  profile.website = clean(onboarding?.website_url) || clean(bizad?.social_links?.website);

  const socialCandidates: Array<string | null | undefined> = [
    onboarding?.facebook_url,
    onboarding?.instagram_url,
    onboarding?.tiktok_url,
    onboarding?.other_social_url,
    bizad?.social_links?.facebook,
    bizad?.social_links?.instagram,
    bizad?.social_links?.tiktok,
    bizad?.social_links?.other,
  ];
  socialCandidates.forEach((raw) => {
    const url = clean(raw);
    if (!url || !isHttp(url)) return;
    if (profile.socials.some((s) => s.url === url)) return;
    profile.socials.push({ label: socialLabel(url), url });
  });

  pushUnique(profile.images, bizad?.flyer_image_url);
  pushUnique(profile.images, onboarding?.flyer_upload_url);
  pushUnique(profile.images, flyer?.thumbnail_url as unknown as string);

  /* ---- text mined from the existing flyer pages ---- */
  const texts: { value: string; size: number }[] = [];
  layers.forEach((l) => {
    if (l.type !== "text") return;
    const v = clean(l.content?.text);
    if (!v) return;
    texts.push({ value: v, size: l.style?.fontSize ?? 16 });
  });

  const headlineCandidate = [...texts]
    .filter((t) => t.value.length >= 4 && t.value.length <= 90)
    .sort((a, b) => b.size - a.size)[0];
  if (headlineCandidate) profile.headline = headlineCandidate.value;

  if (!profile.description) {
    const longest = [...texts].sort((a, b) => b.value.length - a.value.length)[0];
    if (longest && longest.value.length > 60) profile.description = longest.value;
  }
  if (!profile.tagline) {
    const sub = texts.find(
      (t) => t.value !== profile.headline && t.value.length > 12 && t.value.length <= 70
    );
    if (sub) profile.tagline = sub.value;
  }

  /* ---- images from the existing flyer pages ---- */
  layers.forEach((l) => {
    if (l.type === "image") pushUnique(profile.images, l.content?.src);
  });

  /* ---- actions: contact details, CTAs, services, pricing, portfolio ---- */
  const seenCta = new Set<string>();
  const addCta = (label: string | undefined, action: LayerAction | null | undefined) => {
    const lbl = clean(label);
    if (!lbl || !action) return;
    const key = `${action.type}:${lbl.toLowerCase()}`;
    if (seenCta.has(key)) return;
    seenCta.add(key);
    profile.ctas.push({ label: lbl, action });
  };

  layers.forEach((l) => {
    const a = l.action;
    if (!a) return;
    const p = a.payload ?? {};
    const label = clean(l.content?.label) || clean(l.content?.text);

    switch (a.type) {
      case "call":
      case "sms":
        if (!profile.phone) profile.phone = clean(p.phone);
        addCta(label ?? "Call us", a);
        break;
      case "map":
        if (!profile.address) profile.address = clean(p.mapAddress);
        addCta(label ?? "Get directions", a);
        break;
      case "open_url": {
        const url = clean(p.url);
        if (url && isHttp(url)) {
          if (!profile.website) profile.website = url;
          const sl = socialLabel(url);
          if (sl !== "Website" && !profile.socials.some((s) => s.url === url)) {
            profile.socials.push({ label: sl, url });
          }
        }
        addCta(label, a);
        break;
      }
      case "buy_product": {
        const name = clean(p.productName);
        if (name) {
          profile.services.push({ title: name, body: clean(p.productDescription), image: clean(p.productImageUrl) });
          const price = clean(p.productPrice);
          if (price) {
            profile.pricing.push({
              name,
              price: `${clean(p.productCurrency) ?? ""}${price}`.trim(),
              features: clean(p.productDescription) ? [clean(p.productDescription)!] : [],
            });
          }
        }
        addCta(label ?? clean(p.productCtaLabel), a);
        break;
      }
      case "product_grid":
        (p.products ?? []).forEach((prod) => {
          const name = clean(prod.name);
          if (!name) return;
          profile.services.push({ title: name, body: clean(prod.description), image: clean(prod.imageUrl) });
          const price = clean(prod.price);
          if (price) {
            profile.pricing.push({
              name,
              price: `${clean(prod.currency) ?? ""}${price}`.trim(),
              features: clean(prod.description) ? [clean(prod.description)!] : [],
            });
          }
          pushUnique(profile.images, prod.imageUrl);
        });
        addCta(label ?? clean(p.productGridCtaLabel), a);
        break;
      case "menu_add_item": {
        const item = p.menuItem;
        const name = clean(item?.name);
        if (name) {
          profile.services.push({ title: name, body: clean(item?.description) });
          if (item?.price != null) {
            profile.pricing.push({ name, price: String(item.price), features: [] });
          }
        }
        break;
      }
      case "show_menu":
        addCta(label ?? clean(p.menuCtaLabel) ?? "View menu", a);
        break;
      case "gallery":
        (p.galleryImages ?? []).forEach((g, i) => {
          if (!isHttp(g.url)) return;
          pushUnique(profile.images, g.url);
          profile.portfolio.push({
            title: clean(g.caption) ?? `Gallery ${i + 1}`,
            image: g.url,
          });
        });
        addCta(label ?? clean(p.galleryTitle), a);
        break;
      case "carousel":
        (p.carouselSlides ?? []).forEach((s) => {
          const img = clean(s.posterUrl) || (s.kind === "image" ? clean(s.mediaUrl) : undefined);
          pushUnique(profile.images, img);
          const title = clean(s.title);
          if (title) {
            profile.portfolio.push({ title, description: clean(s.subtitle), image: img });
          }
        });
        break;
      case "book_appointment":
        if (!profile.address) profile.address = clean(p.apptLocation);
        addCta(label ?? "Book appointment", a);
        break;
      case "form":
      case "subscribe":
      case "reserve_table":
      case "schedule_consultation":
      case "checkout":
        addCta(label, a);
        break;
      default:
        addCta(label, a);
        break;
    }
  });

  // de-dup services / pricing / portfolio by title
  const dedupe = <T extends { title?: string; name?: string }>(list: T[]) => {
    const seen = new Set<string>();
    return list.filter((x) => {
      const k = (x.title ?? x.name ?? "").toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  profile.services = dedupe(profile.services).slice(0, 6);
  profile.pricing = dedupe(profile.pricing).slice(0, 3);
  profile.portfolio = dedupe(profile.portfolio).slice(0, 4);
  profile.images = profile.images.slice(0, 12);
  profile.ctas = profile.ctas.slice(0, 6);

  return profile;
}
