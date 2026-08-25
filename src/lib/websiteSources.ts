import { supabase } from "@/integrations/supabase/client";
import { getOnboardingForFlyer } from "@/lib/onboarding";
import { getBizadForFlyer } from "@/lib/bizad";
import type { OnboardingSubmission } from "@/lib/onboarding";
import type { BizadRecord } from "@/lib/bizad";
import type { Flyer } from "@/types/flyer";

/** Client dashboard/profile record (public.profiles). */
export type ClientProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  headline: string | null;
  brokerage: string | null;
};

/** Job/project record that owns the current flyer. */
export type ProjectJob = {
  id: string;
  title: string | null;
  brief: string | null;
  type: string | null;
};

/** Connected social account from the Social Command Center. */
export type ConnectedSocial = {
  platform: string;
  username: string | null;
  account_name: string | null;
};

/** Approved testimonial/review left on this project. */
export type ProjectTestimonial = {
  name: string | null;
  body: string | null;
  rating: number | null;
  photo_url: string | null;
};

export type WebsiteSources = {
  clientProfile: ClientProfile | null;
  /** Onboarding tied to THIS project. */
  projectOnboarding: OnboardingSubmission | null;
  /**
   * @deprecated Always null. Account-wide onboarding is never used — a project
   * must never show another project's business information.
   */
  dashboardOnboarding: OnboardingSubmission | null;
  bizad: BizadRecord | null;
  job: ProjectJob | null;
  socialAccounts: ConnectedSocial[];
  testimonials: ProjectTestimonial[];
};


const safe = async <T>(p: PromiseLike<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

/**
 * Drops any row that does not belong to the given project. Cross-project and
 * cross-account data must never reach a website, even on the same login.
 */
function assertProject<T extends Record<string, unknown>>(
  row: T | null,
  field: keyof T & string,
  expected: string | null,
): T | null {
  if (!row) return null;
  const value = row[field];
  if (!expected || typeof value !== "string" || value !== expected) {
    if (value !== undefined && value !== expected) return null;
  }
  return row;
}

/**
 * Loads information about the CURRENT project only. Business identity always
 * comes from this project's own onboarding / business card / job — never from
 * another project and never from another account. The account profile row is
 * used only for the owner's personal contact details.
 */
export async function loadWebsiteSources(flyer: Flyer): Promise<WebsiteSources> {
  const ownerId = (flyer as unknown as { owner_id?: string }).owner_id ?? null;

  const [projectOnboardingRaw, bizadRaw] = await Promise.all([
    safe(getOnboardingForFlyer(flyer.id), null),
    safe(getBizadForFlyer(flyer.id), null),
  ]);

  const bizad = assertProject(bizadRaw as unknown as Record<string, unknown> | null, "flyer_id", flyer.id) as
    | BizadRecord
    | null;

  const clientId = ownerId ?? projectOnboardingRaw?.user_id ?? null;
  // Onboarding written by a different account never applies to this project.
  const projectOnboarding =
    projectOnboardingRaw && clientId && projectOnboardingRaw.user_id !== clientId ? null : projectOnboardingRaw;

  const [clientProfile, job, testimonials] = await Promise.all([
    clientId
      ? safe(
          supabase
            .from("profiles")
            .select("id, full_name, email, phone, photo_url, headline, brokerage")
            .eq("id", clientId)
            .maybeSingle()
            .then((r) => (r.data as ClientProfile | null) ?? null),
          null
        )
      : Promise.resolve(null),
    safe(
      supabase
        .from("jobs")
        .select("id, title, brief, type")
        .eq("flyer_id", flyer.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => (r.data as ProjectJob | null) ?? null),
      null
    ),
    safe(
      supabase
        .from("testimonials")
        .select("name, body, rating, photo_url")
        .eq("flyer_id", flyer.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6)
        .then((r) => ((r.data as ProjectTestimonial[] | null) ?? [])),
      [] as ProjectTestimonial[]
    ),
  ]);

  return { clientProfile, projectOnboarding, dashboardOnboarding, bizad, job, socialAccounts, testimonials };

}
