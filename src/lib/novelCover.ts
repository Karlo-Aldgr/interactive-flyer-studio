import type { FlyerPage } from "@/types/flyer";

export function novelCoverFromPage(page?: FlyerPage | null): string | undefined {
  if (!page) return undefined;
  if (page.background?.image?.trim()) return page.background.image.trim();
  const images = page.layers.filter((l) => l.type === "image" && l.content.src?.trim());
  if (!images.length) return undefined;
  const largest = images.sort(
    (a, b) => b.size.width * b.size.height - a.size.width * a.size.height,
  )[0];
  return largest.content.src?.trim();
}

export function resolveNovelCoverUrl(
  uploaded?: string | null,
  fallback?: string | null,
): string | undefined {
  if (uploaded?.trim()) return uploaded.trim();
  if (fallback?.trim()) return fallback.trim();
  return undefined;
}
