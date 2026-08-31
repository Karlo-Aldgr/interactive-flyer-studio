import type { FlyerPage } from "@/types/flyer";
import type { WebsiteProfile } from "@/lib/websiteProfile";
import { buildWebsitePage, type WebsiteDevice } from "@/lib/websitePage";
import { buildDazzleWebsitePage } from "@/lib/websiteTemplates/dazzle";
import wavexThumb from "@/assets/website-template-wavex.jpg";
import dazzleThumb from "@/assets/website-template-dazzle.jpg";

/**
 * Registry of the selectable website templates.
 *
 * Every template is only a LAYOUT BUILDER: it returns the same FlyerPage /
 * Layer / LayerAction structure, so the editor, action system, responsive
 * rebuild, public renderer and publishing flow are shared by all of them.
 */

export type WebsiteTemplateId = "wavex" | "dazzle";

export interface WebsiteTemplate {
  id: WebsiteTemplateId;
  name: string;
  description: string;
  thumbnail: string;
  build: (flyerId: string, index: number, profile: WebsiteProfile, device?: WebsiteDevice) => FlyerPage;
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: "wavex",
    name: "WaveX",
    description: "Clean agency layout with photo bands, portfolio grid and stats.",
    thumbnail: wavexThumb,
    build: buildWebsitePage,
  },
  {
    id: "dazzle",
    name: "Dazzle",
    description: "Bold gradient app-landing one-pager with feature cards and pill buttons.",
    thumbnail: dazzleThumb,
    build: buildDazzleWebsitePage,
  },
];

export const DEFAULT_WEBSITE_TEMPLATE: WebsiteTemplateId = "wavex";

export function getWebsiteTemplate(id?: string | null): WebsiteTemplate {
  return (
    WEBSITE_TEMPLATES.find((t) => t.id === id) ??
    WEBSITE_TEMPLATES.find((t) => t.id === DEFAULT_WEBSITE_TEMPLATE)!
  );
}

/** Builds a website page with the chosen template. */
export function buildWebsitePageWithTemplate(
  templateId: WebsiteTemplateId | undefined,
  flyerId: string,
  index: number,
  profile: WebsiteProfile,
  device: WebsiteDevice = "desktop"
): FlyerPage {
  const tpl = getWebsiteTemplate(templateId);
  const page = tpl.build(flyerId, index, profile, device);
  return {
    ...page,
    background: { ...page.background, websiteTemplate: tpl.id },
  };
}
