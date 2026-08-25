import type { Flyer, FlyerPage, Layer, LayerAction } from "@/types/flyer";
import type { OnboardingSubmission } from "@/lib/onboarding";
import type { BizadRecord } from "@/lib/bizad";
import type { WebsiteSources } from "@/lib/websiteSources";

/**
 * Content used to initialise a Website page for the CURRENT client AND the
 * CURRENT project.
 *
 * Sources, in priority order:
 *  1. Project-specific information (this project's onboarding, business card, job)
 *  2. The client's Dashboard/Profile information (profiles row, latest onboarding,
 *     connected social accounts)
 *  3. The existing flyer pages (text, images, actions)
 *  4. Template defaults (only where nothing real exists)
 *
 * Nothing is invented. Missing values stay undefined so the website builder can
 * hide the matching section instead of writing fake business content.
 */
export interface WebsiteProfile {
  businessName?: string;
  ownerName?: string;
  /** Business theme/category, e.g. "restaurant", "realtor", "event". */
  theme?: string;
  headline?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  heroImage?: string;
  images: string[];
  services: { title: string; body?: string; image?: string }[];
  pricing: { name: string; price: string; features: string[] }[];
  portfolio: { title: string; category?: string; description?: string; image?: string }[];
  /** Special offer / promotion found in the project content. */
  offer?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  hours?: string[];
  website?: string;
  brandColors?: { accent?: string; background?: string };
  socials: { label: string; url: string }[];
  ctas: { label: string; action: LayerAction }[];
  /** Real people connected to the project (never invented). */
  team: { name: string; role?: string; body?: string; photo?: string }[];
  /** Counts derived from real project data only. */
  stats: { value: string; label: string }[];
  /** Approved reviews left on this project. */
  testimonials: { name?: string; body: string; rating?: number; photo?: string }[];
  /** Announcements / updates taken from the project's own pages. */
  news: { title: string; body?: string; image?: string }[];
}


const clean = (v?: string | null) => {
  const s = (v ?? "").toString().replace(/\s+/g, " ").trim();
  return s ? s : undefined;
};

const isHttp = (v?: string | null) => !!v && /^(https?:)?\/\//i.test(v.trim());

const first = (...vals: Array<string | null | undefined>) => {
  for (const v of vals) {
    const c = clean(v);
    if (c) return c;
  }
  return undefined;
};

const isColor = (v?: string | null) => !!v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

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
  if (u.includes("wa.me") || u.includes("whatsapp")) return "WhatsApp";
  if (u.includes("x.com") || u.includes("twitter")) return "X";
  return "Website";
}

/** Builds a profile URL for a CONNECTED social account (never invented). */
function connectedSocialUrl(platform: string, username?: string | null): string | undefined {
  const u = clean(username)?.replace(/^@/, "");
  if (!u || /\s/.test(u)) return undefined;
  switch (platform) {
    case "facebook":
      return `https://facebook.com/${u}`;
    case "instagram":
      return `https://instagram.com/${u}`;
    case "tiktok":
      return `https://tiktok.com/@${u}`;
    case "linkedin":
      return `https://linkedin.com/in/${u}`;
    case "x":
      return `https://x.com/${u}`;
    case "youtube":
      return `https://youtube.com/@${u}`;
    default:
      return undefined;
  }
}

const THEME_KEYWORDS: Array<[string, RegExp]> = [
  ["restaurant", /restaurant|food|kitchen|cuisine|menu|caf[eé]|catering|grill|bakery|pizza|dining/i],
  ["realtor", /real ?estate|realtor|property|properties|listing|brokerage|homes for sale/i],
  ["beauty", /salon|spa|beauty|hair|nails|barber|lash|makeup|skincare|massage/i],
  ["construction", /construction|contractor|builder|renovation|roofing|plumbing|electrical|remodel|landscap/i],
  ["event", /event|party|wedding|dj\b|concert|festival|gala|birthday/i],
  ["fitness", /gym|fitness|trainer|yoga|pilates|workout/i],
  ["retail", /shop|store|boutique|retail|clothing|fashion|merch/i],
  ["personal", /portfolio|personal brand|author|artist|musician|photographer|consultant|speaker/i],
];

function detectTheme(text: string, flyerCategory?: string | null): string | undefined {
  for (const [theme, re] of THEME_KEYWORDS) {
    if (re.test(text)) return theme;
  }
  const cat = clean(flyerCategory);
  if (cat === "realtor") return "realtor";
  if (cat === "event") return "event";
  if (cat === "business") return "business";
  return undefined;
}

const OFFER_RE = /(\d{1,3}\s?%\s?off|free\s+\w+|buy\s+\w+\s+get|special|promo(tion)?|discount|deal\b|\bsale\b)/i;
const HOURS_RE = /(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*[-–—:]|open\s+(daily|mon|\d)|\d{1,2}\s?(am|pm)\s?[-–—]\s?\d{1,2}\s?(am|pm)/i;

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
  /** Client dashboard/profile + project records (see loadWebsiteSources). */
  sources?: Partial<WebsiteSources> | null;
  /** Deprecated single-source args, still supported. */
  onboarding?: OnboardingSubmission | null;
  bizad?: BizadRecord | null;
}): WebsiteProfile {
  const { flyer, pages } = args;
  const src = args.sources ?? {};
  const onboarding = args.onboarding ?? src.projectOnboarding ?? null;
  const bizad = args.bizad ?? src.bizad ?? null;
  const dash = src.dashboardOnboarding ?? null;
  const client = src.clientProfile ?? null;
  const job = src.job ?? null;
  const layers = orderedLayers(pages);

  const profile: WebsiteProfile = {
    images: [],
    services: [],
    pricing: [],
    portfolio: [],
    socials: [],
    ctas: [],
    team: [],
    stats: [],
    testimonials: [],
    news: [],
  };


  /* ---- identity / contact -------------------------------------------------
     Priority: project onboarding → project business card → client dashboard
     onboarding → client profile record → job/flyer title.                    */
  profile.businessName = first(
    onboarding?.business_name,
    bizad?.business_name,
    dash?.business_name,
    job?.title,
    flyer?.title
  );
  profile.ownerName = first(onboarding?.full_name, bizad?.owner_name, dash?.full_name, client?.full_name);
  profile.tagline = first(onboarding?.business_slogan, dash?.business_slogan, client?.headline);
  profile.description = first(
    onboarding?.business_description,
    bizad?.about_text,
    onboarding?.ai_description,
    dash?.business_description,
    dash?.ai_description,
    job?.brief
  );
  profile.logoUrl = first(onboarding?.logo_url, bizad?.logo_url, dash?.logo_url, client?.photo_url);
  profile.phone = first(onboarding?.phone, bizad?.phone, dash?.phone, client?.phone);
  profile.email = first(onboarding?.email, bizad?.email, dash?.email, client?.email);
  profile.address = first(onboarding?.business_address, bizad?.address, dash?.business_address);
  profile.website = first(onboarding?.website_url, bizad?.social_links?.website, dash?.website_url);

  /* ---- brand colours from the project's digital business card ---- */
  const accent = isColor(bizad?.button_color) ? clean(bizad?.button_color) : undefined;
  const background = isColor(bizad?.background_color) ? clean(bizad?.background_color) : undefined;
  if (accent || background) profile.brandColors = { accent, background };

  /* ---- business theme / category ---- */
  profile.theme = detectTheme(
    [profile.businessName, profile.tagline, profile.description, job?.title, job?.brief]
      .filter(Boolean)
      .join(" "),
    (flyer as unknown as { category?: string })?.category
  );

  /* ---- social links: project → dashboard → connected accounts ---- */
  const socialCandidates: Array<string | null | undefined> = [
    onboarding?.facebook_url,
    onboarding?.instagram_url,
    onboarding?.tiktok_url,
    onboarding?.other_social_url,
    bizad?.social_links?.facebook,
    bizad?.social_links?.instagram,
    bizad?.social_links?.tiktok,
    bizad?.social_links?.other,
    dash?.facebook_url,
    dash?.instagram_url,
    dash?.tiktok_url,
    dash?.other_social_url,
    flyer?.settings?.social?.facebook,
    flyer?.settings?.social?.instagram,
    flyer?.settings?.social?.tiktok,
    flyer?.settings?.social?.youtube,
    flyer?.settings?.social?.linkedin,
    flyer?.settings?.social?.twitter,
    flyer?.settings?.social?.threads,
    flyer?.settings?.social?.snapchat,
    ...(src.socialAccounts ?? []).map((a) => connectedSocialUrl(a.platform, a.username ?? a.account_name)),
  ];
  const addSocial = (raw?: string | null) => {
    const url = clean(raw);
    if (!url || !isHttp(url)) return;
    const label = socialLabel(url);
    if (label === "WhatsApp" && !profile.whatsapp) profile.whatsapp = url;
    if (label === "Website") return;
    if (profile.socials.some((s) => s.url === url || s.label === label)) return;
    profile.socials.push({ label, url });
  };
  socialCandidates.forEach(addSocial);

  pushUnique(profile.images, bizad?.flyer_image_url);
  pushUnique(profile.images, onboarding?.flyer_upload_url);
  /* The auto-generated flyer thumbnail is letterboxed, so it is only used as a
     last resort (added after the real flyer artwork below). */
  const thumbnailUrl = flyer?.thumbnail_url as unknown as string | undefined;

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

  /* ---- offer / business hours found in the flyer text ---- */
  const offerText = texts.find((t) => t.value.length <= 90 && OFFER_RE.test(t.value));
  if (offerText) profile.offer = offerText.value;
  const hourLines = texts.filter((t) => t.value.length <= 80 && HOURS_RE.test(t.value)).map((t) => t.value);
  if (hourLines.length) profile.hours = Array.from(new Set(hourLines)).slice(0, 7);

  /* ---- theme refinement using real project content ---- */
  if (!profile.theme) {
    profile.theme = detectTheme(texts.map((t) => t.value).join(" "));
  }



  /* ---- images from the existing flyer pages ---- */
  layers.forEach((l) => {
    if (l.type === "image") pushUnique(profile.images, l.content?.src);
  });
  pushUnique(profile.images, thumbnailUrl);

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
          if (!profile.website && socialLabel(url) === "Website") profile.website = url;
          addSocial(url);
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
  profile.portfolio = dedupe(profile.portfolio).slice(0, 8);
  profile.images = profile.images.slice(0, 12);
  profile.ctas = profile.ctas.slice(0, 6);

  /* ---- team: only real people attached to the client/project ---- */
  const ownerName = profile.ownerName;
  if (ownerName) {
    profile.team.push({
      name: ownerName,
      role: clean(client?.headline) ?? clean(client?.brokerage) ?? (profile.businessName ? `${profile.businessName}` : undefined),
      body: profile.tagline,
      photo: clean(client?.photo_url) ?? profile.logoUrl,
    });
  }

  /* ---- testimonials: approved reviews on this project ---- */
  (src.testimonials ?? []).forEach((t) => {
    const body = clean(t.body);
    if (!body) return;
    profile.testimonials.push({
      name: clean(t.name),
      body,
      rating: t.rating ?? undefined,
      photo: clean(t.photo_url),
    });
  });

  /* ---- statistics: counts of REAL project data only ---- */
  const statCandidates: Array<{ value: number; label: string }> = [
    { value: profile.portfolio.length, label: profile.theme === "realtor" ? "Listings" : "Showcased works" },
    { value: profile.services.length, label: profile.theme === "restaurant" ? "Menu items" : "Services" },
    { value: profile.images.length, label: "Photos" },
    { value: profile.socials.length, label: "Social channels" },
    { value: profile.testimonials.length, label: "Reviews" },
  ];
  const usableStats = statCandidates.filter((s) => s.value > 0);
  if (usableStats.length >= 3) {
    profile.stats = usableStats.slice(0, 4).map((s) => ({ value: String(s.value), label: s.label }));
  }

  /* ---- news / updates: taken from the project's own pages + offer ---- */
  if (profile.offer) profile.news.push({ title: profile.offer, body: profile.tagline, image: profile.images[1] });
  [...pages]
    .filter((p) => !p.background?.websitePage)
    .sort((a, b) => a.index - b.index)
    .forEach((p, i) => {
      const pageTexts = p.layers
        .filter((l) => l.type === "text" && clean(l.content?.text))
        .sort((a, b) => (b.style?.fontSize ?? 0) - (a.style?.fontSize ?? 0));
      const title = clean(pageTexts[0]?.content?.text);
      if (!title) return;
      const body = clean(pageTexts.find((l) => (clean(l.content?.text)?.length ?? 0) > 40)?.content?.text);
      const img = p.layers.find((l) => l.type === "image" && isHttp(l.content?.src))?.content?.src;
      if (profile.news.some((n) => n.title.toLowerCase() === title.toLowerCase())) return;
      profile.news.push({ title, body, image: clean(img) });
      void i;
    });
  profile.news = profile.news.slice(0, 4);

  return profile;

}
