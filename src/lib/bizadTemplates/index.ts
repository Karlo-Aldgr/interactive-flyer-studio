import type { FlyerPage } from "@/types/flyer";
import type { BizadRecord } from "@/lib/bizad";
import { BIZAD_PAGE_NAME, VONTASTIC_TEMPLATE_ID, buildVontasticBizadPage } from "@/lib/bizadTemplates/vontastic";
import {
  GRADIENT_PROFILE_DEFAULT_FROM,
  GRADIENT_PROFILE_DEFAULT_TO,
  GRADIENT_PROFILE_TEMPLATE_ID,
  buildGradientProfilePage,
} from "@/lib/bizadTemplates/gradientProfile";
import {
  CLEAN_GRID_DEFAULT_ACCENT,
  CLEAN_GRID_TEMPLATE_ID,
  buildCleanActionGridPage,
} from "@/lib/bizadTemplates/cleanActionGrid";

export {
  BIZAD_PAGE_NAME,
  VONTASTIC_TEMPLATE_ID,
  GRADIENT_PROFILE_TEMPLATE_ID,
  GRADIENT_PROFILE_DEFAULT_FROM,
  GRADIENT_PROFILE_DEFAULT_TO,
  CLEAN_GRID_TEMPLATE_ID,
  CLEAN_GRID_DEFAULT_ACCENT,
};

export type BizadTemplate = {
  id: string;
  name: string;
  description: string;
  /** Preview swatch shown in the template chooser. */
  preview: { background: string; accent: string; text: string };
  build: (flyerId: string, index: number, bizad: BizadRecord) => FlyerPage;
};

export const BIZAD_TEMPLATES: BizadTemplate[] = [
  {
    id: VONTASTIC_TEMPLATE_ID,
    name: "Standard",
    description: "Dark card with flyer hero, paired action buttons and QR code.",
    preview: { background: "#0f172a", accent: "#f97316", text: "#ffffff" },
    build: buildVontasticBizadPage,
  },
  {
    id: GRADIENT_PROFILE_TEMPLATE_ID,
    name: "Gradient Profile",
    description: "Cover photo, circular portrait and stacked pill actions on an editable gradient.",
    preview: { background: `linear-gradient(160deg, ${GRADIENT_PROFILE_DEFAULT_FROM}, ${GRADIENT_PROFILE_DEFAULT_TO})`, accent: "#ffffff", text: "#ffffff" },
    build: buildGradientProfilePage,
  },
  {
    id: CLEAN_GRID_TEMPLATE_ID,
    name: "Clean Action Grid",
    description: "Light card with logo header, photo and a responsive grid of action tiles.",
    preview: { background: "#f8fafc", accent: CLEAN_GRID_DEFAULT_ACCENT, text: "#0f172a" },
    build: buildCleanActionGridPage,
  },
];

export function getBizadTemplate(id?: string | null): BizadTemplate {
  return BIZAD_TEMPLATES.find((t) => t.id === id) ?? BIZAD_TEMPLATES[0];
}

/** Build the editor page for a card using its selected template. */
export function buildBizadPage(flyerId: string, index: number, bizad: BizadRecord): FlyerPage {
  return getBizadTemplate(bizad.template_id).build(flyerId, index, bizad);
}
