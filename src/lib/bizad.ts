import { supabase } from "@/integrations/supabase/client";
import { buildPublicFlyerUrl, slugBaseFromTitle } from "@/lib/utils";
import type { OnboardingSubmission } from "@/lib/onboarding";
import { BIZAD_DEFAULT_BACKGROUND_COLOR, BIZAD_DEFAULT_BUTTON_COLOR } from "@/lib/bizadDefaults";
import { buildBizadPage, layoutFromPage } from "@/lib/bizadPage";
import { VONTASTIC_TEMPLATE_ID } from "@/lib/bizadTemplates/vontastic";
import type { FlyerPage, FlyerSettings } from "@/types/flyer";

export type BizadSocialLinks = {
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  other?: string | null;
};

export type BizadRecord = {
  id: string;
  flyer_id: string;
  enabled: boolean;
  slug: string;
  business_name: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  about_text: string | null;
  flyer_image_url: string | null;
  owner_photo_url: string | null;
  logo_url: string | null;
  address: string | null;
  social_links: BizadSocialLinks;
  button_color: string;
  background_color: string;
  gallery_url: string | null;
  video_url: string | null;
  copyright_text: string | null;
  /** Image shown when sharing the /bizads link on social apps. */
  share_image_url: string | null;
  /** Selected card template id (see src/lib/bizadTemplates). */
  template_id: string;
  job_title: string | null;
  company_name: string | null;
  cover_image_url: string | null;
  custom_link_label: string | null;
  custom_link_url: string | null;
  booking_url: string | null;
  accent_color: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  /** Saved editor page layout (elements/size/background) rendered on the public card. */
  layout?: any | null;
  created_at: string;
  updated_at: string;
};

export type BizadFlyerContext = {
  id: string;
  public_slug: string | null;
  thumbnail_url: string | null;
  title: string;
};

function socialLinksFromOnboarding(o: OnboardingSubmission): BizadSocialLinks {
  return {
    website: o.website_url,
    facebook: o.facebook_url,
    instagram: o.instagram_url,
    tiktok: o.tiktok_url,
    other: o.other_social_url,
  };
}

export function buildBizadSlug(
  onboarding: OnboardingSubmission | null,
  flyer: BizadFlyerContext,
): string {
  if (flyer.public_slug) return flyer.public_slug;
  const base = slugBaseFromTitle(onboarding?.business_name || flyer.title || "bizad");
  return `${base}-${flyer.id.slice(0, 6)}`;
}

export function buildBizadPayloadFromOnboarding(
  onboarding: OnboardingSubmission | null,
  flyer: BizadFlyerContext,
  existing?: Partial<BizadRecord> | null,
): Omit<BizadRecord, "id" | "created_at" | "updated_at"> {
  const slug = existing?.slug || buildBizadSlug(onboarding, flyer);
  const galleryUrl =
    existing?.gallery_url ||
    (flyer.public_slug ? buildPublicFlyerUrl(flyer.public_slug) : null);

  return {
    flyer_id: flyer.id,
    enabled: existing?.enabled ?? false,
    slug,
    // PER-PROJECT RULE: identity may only come from THIS project's onboarding,
    // THIS project's existing card, or THIS flyer. Never another project.
    business_name: onboarding?.business_name ?? existing?.business_name ?? flyer.title ?? null,
    owner_name: onboarding?.full_name ?? existing?.owner_name ?? null,
    phone: onboarding?.phone ?? existing?.phone ?? null,
    email: onboarding?.email ?? existing?.email ?? null,
    about_text: onboarding?.business_description ?? existing?.about_text ?? null,
    flyer_image_url: flyer.thumbnail_url ?? existing?.flyer_image_url ?? null,
    owner_photo_url: existing?.owner_photo_url ?? null,
    logo_url: onboarding?.logo_url ?? existing?.logo_url ?? null,
    address: onboarding?.business_address ?? existing?.address ?? null,
    social_links: onboarding ? socialLinksFromOnboarding(onboarding) : (existing?.social_links ?? {}),
    button_color: existing?.button_color ?? BIZAD_DEFAULT_BUTTON_COLOR,
    background_color: existing?.background_color ?? BIZAD_DEFAULT_BACKGROUND_COLOR,
    gallery_url: galleryUrl,
    video_url: existing?.video_url ?? null,
    copyright_text:
      existing?.copyright_text ??
      (onboarding?.business_name
        ? `© ${onboarding.business_name} ${new Date().getFullYear()}`
        : existing?.business_name
          ? `© ${existing.business_name} ${new Date().getFullYear()}`
          : null),
    share_image_url:
      existing?.share_image_url ??
      flyer.thumbnail_url ??
      existing?.flyer_image_url ??
      null,
    template_id: existing?.template_id ?? VONTASTIC_TEMPLATE_ID,
    job_title: existing?.job_title ?? null,
    company_name: existing?.company_name ?? onboarding?.business_name ?? null,
    cover_image_url: existing?.cover_image_url ?? null,
    custom_link_label: existing?.custom_link_label ?? null,
    custom_link_url: existing?.custom_link_url ?? null,
    booking_url: existing?.booking_url ?? null,
    accent_color: existing?.accent_color ?? null,
    gradient_from: existing?.gradient_from ?? null,
    gradient_to: existing?.gradient_to ?? null,
  };
}

export async function updateBizadLayout(flyerId: string, layout: unknown): Promise<void> {
  const { error } = await supabase
    .from("bizads" as any)
    .update({ layout: layout as any, updated_at: new Date().toISOString() })
    .eq("flyer_id", flyerId);
  if (error) throw error;
}

export async function syncBizadLayoutFromEditor(
  flyerId: string,
  pages: FlyerPage[],
  settings?: FlyerSettings | null,
): Promise<void> {
  const bizadPage = pages.find((p) => p.background?.bizadPage);
  if (!bizadPage) return;
  await updateBizadLayout(
    flyerId,
    bizadPage.background?.bizadHidden ? null : layoutFromPage(bizadPage, settings),
  );
}

/** Rebuild the public card layout from bizad record fields (colors, contact, copy). */
export async function rebuildAndSaveBizadLayout(
  bizad: Pick<BizadRecord, "flyer_id" | "enabled"> & Partial<BizadRecord>,
  settings?: FlyerSettings | null,
): Promise<void> {
  if (!bizad.enabled) {
    await updateBizadLayout(bizad.flyer_id, null);
    return;
  }
  const page = buildBizadPage(bizad.flyer_id, 0, bizad as BizadRecord);
  await updateBizadLayout(bizad.flyer_id, layoutFromPage(page, settings));
}

/** After canvas edits, keep bizads row colors aligned with the editor page. */
export async function syncBizadRecordFromEditorPage(
  flyerId: string,
  pages: FlyerPage[],
  settings?: FlyerSettings | null,
): Promise<void> {
  const bizadPage = pages.find((p) => p.background?.bizadPage);
  if (!bizadPage) return;

  const buttonLayer = bizadPage.layers.find((l) => l.type === "button");
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (bizadPage.background?.color) patch.background_color = bizadPage.background.color;
  if (buttonLayer?.style?.fill) patch.button_color = buttonLayer.style.fill;

  const { error: metaError } = await supabase.from("bizads" as any).update(patch).eq("flyer_id", flyerId);
  if (metaError) throw metaError;

  await syncBizadLayoutFromEditor(flyerId, pages, settings);
}

export async function getBizadForFlyer(flyerId: string): Promise<BizadRecord | null> {
  const { data, error } = await supabase
    .from("bizads" as any)
    .select("*")
    .eq("flyer_id", flyerId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as BizadRecord | null) ?? null;
}

export async function loadPublicBizad(slug: string): Promise<BizadRecord | null> {
  const { data, error } = await supabase
    .from("bizads" as any)
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as BizadRecord | null) ?? null;
}

export async function upsertBizad(
  payload: Omit<BizadRecord, "id" | "created_at" | "updated_at">,
): Promise<BizadRecord> {
  const { data, error } = await supabase
    .from("bizads" as any)
    .upsert(
      { ...payload, updated_at: new Date().toISOString() },
      { onConflict: "flyer_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as BizadRecord;
}

export function buildVCard(bizad: Pick<BizadRecord, "owner_name" | "business_name" | "phone" | "email">): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = bizad.owner_name?.trim() || bizad.business_name?.trim() || "Contact";
  lines.push(`FN:${escapeVCard(name)}`);
  if (bizad.business_name?.trim()) lines.push(`ORG:${escapeVCard(bizad.business_name.trim())}`);
  if (bizad.phone?.trim()) lines.push(`TEL;TYPE=CELL:${bizad.phone.trim()}`);
  if (bizad.email?.trim()) lines.push(`EMAIL:${bizad.email.trim()}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function downloadVCard(bizad: Pick<BizadRecord, "owner_name" | "business_name" | "phone" | "email" | "slug">) {
  const blob = new Blob([buildVCard(bizad)], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bizad.slug || "contact"}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Static preview data — use /bizads/demo without running DB migration. */
export const DEMO_BIZAD: BizadRecord = {
  id: "demo",
  flyer_id: "demo",
  enabled: true,
  slug: "demo",
  business_name: "Biggs Auto Repair",
  owner_name: "Mr. Biggs",
  phone: "(555) 867-5309",
  email: "hello@example.com",
  about_text:
    "Family-owned auto repair since 1998. Oil changes, brakes, diagnostics, and honest service. Walk-ins welcome.",
  flyer_image_url: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&auto=format&fit=crop",
  owner_photo_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop",
  logo_url: "https://images.unsplash.com/photo-1625044429174-4ad4afb6e6c8?w=200&auto=format&fit=crop",
  address: "123 Main St, Springfield",
  social_links: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    website: "https://tapthatflyer.com",
  },
  button_color: BIZAD_DEFAULT_BUTTON_COLOR,
  background_color: BIZAD_DEFAULT_BACKGROUND_COLOR,
  gallery_url: "https://tapthatflyer.com",
  video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  copyright_text: "© Biggs Auto Repair",
  template_id: VONTASTIC_TEMPLATE_ID,
  job_title: "Owner / Master Technician",
  company_name: "Biggs Auto Repair",
  cover_image_url: null,
  custom_link_label: null,
  custom_link_url: null,
  booking_url: null,
  accent_color: null,
  gradient_from: null,
  gradient_to: null,
  share_image_url: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&auto=format&fit=crop",
  layout: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
