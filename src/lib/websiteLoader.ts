import { supabase } from "@/integrations/supabase/client";
import type { FlyerPage, Layer } from "@/types/flyer";
import { parseWebsiteDocument, type WebsiteDocument } from "@/lib/websiteDocument";

/**
 * Loads ONLY the saved Website page of a project (page + layers + actions).
 * No flyer pages, no dashboard data, no editor state — just what the public
 * website needs to render.
 */

export interface LoadedWebsite {
  flyerId: string;
  title: string;
  status: "draft" | "published";
  slug: string | null;
  page: FlyerPage;
  doc: WebsiteDocument;
}

function mapPage(p: any): FlyerPage {
  return {
    id: p.id,
    flyer_id: p.flyer_id,
    index: p.index,
    name: p.name,
    background: p.background ?? { color: "#ffffff" },
    layers: (p.layers ?? [])
      .sort((a: any, b: any) => a.z_index - b.z_index)
      .map(
        (l: any): Layer => ({
          id: l.id,
          page_id: l.page_id,
          type: l.type,
          position: l.position,
          size: l.size,
          rotation: Number(l.rotation) || 0,
          z_index: l.z_index,
          style: l.style ?? {},
          content: l.content ?? {},
          action: (l.actions ?? [])[0] ?? null,
        })
      ),
  };
}

async function loadForFlyer(flyerId: string, title: string, status: string, slug: string | null): Promise<LoadedWebsite | null> {
  const { data: pages } = await supabase
    .from("pages")
    .select("id, flyer_id, index, name, background, layers(*, actions(*))")
    .eq("flyer_id", flyerId)
    .order("index", { ascending: true });

  const raw = (pages ?? []).find((p: any) => p?.background?.websitePage);
  if (!raw) return null;
  const page = mapPage(raw);
  const doc = parseWebsiteDocument(page);
  if (!doc) return null;
  return {
    flyerId,
    title,
    status: status === "published" ? "published" : "draft",
    slug,
    page,
    doc,
  };
}

/** Owner/preview load — reads the saved draft through the owner's own RLS access. */
export async function loadWebsiteByFlyerId(flyerId: string): Promise<LoadedWebsite | null> {
  const { data: flyer } = await supabase
    .from("flyers")
    .select("id, title, website_status, website_slug")
    .eq("id", flyerId)
    .maybeSingle();
  if (!flyer) return null;
  return loadForFlyer(flyer.id, flyer.title, (flyer as any).website_status, (flyer as any).website_slug);
}

/** Public load — only resolves websites that were explicitly published. */
export async function loadPublishedWebsite(slug: string): Promise<LoadedWebsite | null> {
  const { data: flyer } = await supabase
    .from("flyers")
    .select("id, title, website_status, website_slug")
    .eq("website_slug", slug)
    .eq("website_status", "published")
    .maybeSingle();
  if (!flyer) return null;
  return loadForFlyer(flyer.id, flyer.title, "published", slug);
}
