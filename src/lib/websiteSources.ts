import { supabase } from "@/integrations/supabase/client";
import { getMyOnboarding, getOnboardingForFlyer } from "@/lib/onboarding";
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
  /** Client's latest onboarding (dashboard-level business profile). */
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
 * Loads every existing source of information about the CURRENT client and the
 * CURRENT project. Nothing new is stored — this only reads records TapThatFlyer
 * already keeps (profiles, onboarding submissions, digital business card, job,
 * connected social accounts).
 */
export async function loadWebsiteSources(flyer: Flyer): Promise<WebsiteSources> {
  const ownerId = (flyer as unknown as { owner_id?: string }).owner_id ?? null;

  const [projectOnboarding, bizad] = await Promise.all([
    safe(getOnboardingForFlyer(flyer.id), null),
    safe(getBizadForFlyer(flyer.id), null),
  ]);

  const clientId = ownerId ?? projectOnboarding?.user_id ?? null;

  const [clientProfile, dashboardOnboarding, job, socialAccounts, testimonials] = await Promise.all([
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
    clientId ? safe(getMyOnboarding(clientId), null) : Promise.resolve(null),
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
    clientId
      ? safe(
          supabase
            .from("social_accounts")
            .select("platform, username, account_name")
            .eq("user_id", clientId)
            .then((r) => ((r.data as ConnectedSocial[] | null) ?? [])),
          [] as ConnectedSocial[]
        )
      : Promise.resolve([] as ConnectedSocial[]),
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
