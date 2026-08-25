import { supabase } from "@/integrations/supabase/client";

/**
 * Public website slugs double as subdomains (`<slug>.tapthatflyer.com`), so
 * they must be lowercase, hostname-safe and globally unique.
 */

const RESERVED = new Set([
  "www", "app", "api", "admin", "auth", "preview", "share", "mail", "email", "cdn",
  "assets", "static", "dashboard", "editor", "site", "sites", "portal", "support",
  "help", "blog", "status", "dev", "staging", "test", "ftp", "ns", "ns1", "ns2",
]);

/** lowercase → hyphenated → specials stripped → collapsed → trimmed to 40 chars. */
export function slugifyBusinessName(name: string): string {
  const base = (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/^-|-$/g, "");
  if (!base || RESERVED.has(base) || /^\d+$/.test(base)) return base ? `${base}-site` : "my-site";
  return base;
}

async function slugFree(slug: string, flyerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("website_slug_available" as any, {
    _slug: slug,
    _flyer_id: flyerId,
  });
  if (error) return false;
  return data === true;
}

/**
 * Returns a unique slug for this project, appending `-2`, `-3`, … on collision.
 * Keeps the project's existing slug when it is still valid.
 */
export async function ensureUniqueWebsiteSlug(
  name: string,
  flyerId: string,
  currentSlug?: string | null,
): Promise<string> {
  if (currentSlug && slugifyBusinessName(currentSlug) === currentSlug) return currentSlug;
  const base = slugifyBusinessName(name);
  if (await slugFree(base, flyerId)) return base;
  for (let i = 2; i < 60; i++) {
    const candidate = `${base}-${i}`;
    if (await slugFree(candidate, flyerId)) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
