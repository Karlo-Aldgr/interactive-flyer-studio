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
