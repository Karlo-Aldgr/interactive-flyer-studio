import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_FLYER_TITLES = new Set(["untitled flyer", "untitled event flyer"]);

export function isRealFlyerTitle(title: string | null | undefined) {
  const normalized = (title || "").trim().toLowerCase();
  return !!normalized && !DEFAULT_FLYER_TITLES.has(normalized);
}

export function slugBaseFromTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "flyer";
}

export function flyerSlugLooksUntitled(slug: string | null | undefined) {
  return /^untitled(?:-event)?-flyer(?:-[a-z0-9]{4,6})?$/i.test(slug || "");
}

export function slugFromFlyerTitle(title: string, currentSlug?: string | null) {
  const suffix = currentSlug?.match(/-([a-z0-9]{4,6})$/i)?.[1] || Math.random().toString(36).slice(2, 7);
  return `${slugBaseFromTitle(title)}-${suffix}`;
}

/** Local-only dev hosts where the editor and public viewer share the same origin. */
function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.endsWith(".local")
  );
}

/** Lovable preview sandboxes — require a Lovable login; never use for public share links. */
export function isLovablePreviewHost(hostname: string): boolean {
  return (
    hostname.includes("preview--") ||
    hostname.includes("id-preview--") ||
    hostname.includes("lovableproject.com")
  );
}

const DEFAULT_PUBLIC_APP_ORIGIN = "https://interactive-flyer-studio.lovable.app";

/**
 * Where public flyer + portal links must point so anyone (incognito, phone QR)
 * can open them without a Lovable account.
 */
export function getPublicAppOrigin(): string {
  const published =
    (import.meta as any).env?.VITE_APP_ORIGIN || DEFAULT_PUBLIC_APP_ORIGIN;
  if (typeof window === "undefined") return published;
  if (isLocalDevHost(window.location.hostname)) return window.location.origin;
  if (isLovablePreviewHost(window.location.hostname)) return published;
  return window.location.origin;
}

/**
 * Origin for social/OG share worker URLs (WhatsApp, iMessage previews).
 * Falls back to the public app origin when no worker is configured.
 */
export function getShareOrigin(): string {
  if (typeof window !== "undefined" && isLocalDevHost(window.location.hostname)) {
    return window.location.origin;
  }
  if (typeof window !== "undefined") {
    const override = window.localStorage.getItem("flyerflow.shareOrigin");
    if (override) return override;
  }
  return (
    (import.meta as any).env?.VITE_SHARE_ORIGIN ||
    "https://tapthatflyer-share.showoffgrafixs.workers.dev"
  );
}

/** Direct public viewer link — use for QR codes, copy link, and portal URLs. */
export function buildPublicFlyerUrl(slug: string): string {
  return `${getPublicAppOrigin().replace(/\/$/, "")}/f/${slug}`;
}

/**
 * Marketing / social posts must always use the published public origin.
 * Local LAN URLs break Facebook/Instagram link previews because Meta cannot crawl them.
 */
export function getMarketingAppOrigin(): string {
  return String(
    (import.meta as any).env?.VITE_APP_ORIGIN || DEFAULT_PUBLIC_APP_ORIGIN,
  ).replace(/\/$/, "");
}

export function buildMarketingFlyerUrl(slug: string): string {
  return `${getMarketingAppOrigin()}/f/${slug}`;
}

/** Always-public share worker origin (never local LAN). */
export function getMarketingShareOrigin(): string {
  return String(
    (import.meta as any).env?.VITE_SHARE_ORIGIN ||
      "https://tapthatflyer-share.showoffgrafixs.workers.dev",
  ).replace(/\/$/, "");
}

/**
 * Social/marketing link: prefer the Share dialog landing-page URL shape
 * (`?page=` / `?open=`) on the public app origin so Meta can crawl it.
 * The Cloudflare workers.dev share host often returns 403 to facebookexternalhit.
 */
export function buildMarketingPublicUrl(args: {
  slug: string;
  landingPageId?: string | null;
  openPageId?: string | null;
}): string {
  if (args.landingPageId) {
    const params = new URLSearchParams();
    params.set("page", args.landingPageId);
    if (args.openPageId) params.set("open", args.openPageId);
    return `${getMarketingAppOrigin()}/f/${args.slug}?${params.toString()}`;
  }
  return buildMarketingFlyerUrl(args.slug);
}

export function buildPublicPortalUrl(token: string, code?: string): string {
  const base = `${getPublicAppOrigin().replace(/\/$/, "")}/p/${token}`;
  return code ? `${base}?code=${encodeURIComponent(code)}` : base;
}

export function buildSocialShareUrl(slug: string): string {
  return `${getShareOrigin().replace(/\/$/, "")}/f/${slug}`;
}

/** Landing share link: crawlers see landing art; humans open the flyer via ?open=. */
export function buildSocialLandingShareUrl(
  slug: string,
  landingPageId: string,
  openPageId?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("page", landingPageId);
  if (openPageId) params.set("open", openPageId);
  return `${buildSocialShareUrl(slug)}?${params.toString()}`;
}

/** Rewrite legacy or preview-only URLs to the public app origin. */
export function normalizeExampleFlyerUrl(url: string): string {
  if (typeof window === "undefined" || !url.trim()) return url;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/f\/([^/]+)\/?$/);
    if (!match) return url;
    const needsRewrite =
      isLovablePreviewHost(parsed.hostname) ||
      parsed.hostname.includes("tapthatflyer") ||
      parsed.hostname.includes("workers.dev") ||
      parsed.hostname.includes("interactive-flyer-studio");
    if (!needsRewrite) return url;
    return buildPublicFlyerUrl(match[1]);
  } catch {
    return url;
  }
}
