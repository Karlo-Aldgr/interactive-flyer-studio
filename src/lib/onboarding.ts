import { supabase } from "@/integrations/supabase/client";

export type OnboardingHelp = "yes" | "more_info" | "no" | null;

export interface OnboardingSubmission {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  business_name: string | null;
  business_address: string | null;
  business_slogan: string | null;
  business_description: string | null;
  website_url: string | null;
  website_help: OnboardingHelp;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  other_social_url: string | null;
  social_help: boolean;
  logo_url: string | null;
  logo_help: OnboardingHelp;
  flyer_upload_url: string | null;
  flyer_job_id: string | null;
  hotspot_suggestions: unknown;
  created_at: string;
  updated_at: string;
}

export type OnboardingInput = Omit<
  OnboardingSubmission,
  "id" | "user_id" | "flyer_upload_url" | "flyer_job_id" | "hotspot_suggestions" | "created_at" | "updated_at"
>;

const CHATBOT_KNOWLEDGE_MAX = 3500;

export type OnboardingKnowledgeSource = Pick<
  OnboardingSubmission,
  | "full_name"
  | "phone"
  | "email"
  | "business_name"
  | "business_slogan"
  | "business_address"
  | "business_description"
  | "website_url"
  | "facebook_url"
  | "instagram_url"
  | "tiktok_url"
  | "other_social_url"
>;

/** Text block fed to Ask AI from onboarding fields. */
export function buildChatbotKnowledgeFromOnboarding(source: OnboardingKnowledgeSource): string {
  const lines: string[] = [];
  if (source.business_name?.trim()) lines.push(`Business name: ${source.business_name.trim()}`);
  if (source.business_slogan?.trim()) lines.push(`Slogan: ${source.business_slogan.trim()}`);
  if (source.business_description?.trim()) {
    lines.push(`About the business:\n${source.business_description.trim()}`);
  }
  if (source.business_address?.trim()) lines.push(`Address: ${source.business_address.trim()}`);
  if (source.phone?.trim()) lines.push(`Phone: ${source.phone.trim()}`);
  if (source.email?.trim()) lines.push(`Email: ${source.email.trim()}`);
  if (source.website_url?.trim()) lines.push(`Website: ${source.website_url.trim()}`);
  if (source.facebook_url?.trim()) lines.push(`Facebook: ${source.facebook_url.trim()}`);
  if (source.instagram_url?.trim()) lines.push(`Instagram: ${source.instagram_url.trim()}`);
  if (source.tiktok_url?.trim()) lines.push(`TikTok: ${source.tiktok_url.trim()}`);
  if (source.other_social_url?.trim()) lines.push(`Other social: ${source.other_social_url.trim()}`);
  return lines.join("\n").slice(0, CHATBOT_KNOWLEDGE_MAX);
}

export async function syncOnboardingToFlyerChatbot(
  flyerId: string,
  source: OnboardingKnowledgeSource,
): Promise<void> {
  const text = buildChatbotKnowledgeFromOnboarding(source);
  if (!text.trim()) return;
  const { error } = await supabase.from("flyers").update({ chatbot_knowledge: text }).eq("id", flyerId);
  if (error) throw error;
}

export async function syncOnboardingChatbotKnowledgeForJob(jobId: string): Promise<void> {
  const onboarding = await getOnboardingForJob(jobId);
  if (!onboarding) return;
  const { data: job, error } = await supabase.from("jobs").select("flyer_id").eq("id", jobId).maybeSingle();
  if (error) throw error;
  if (!job?.flyer_id) return;
  await syncOnboardingToFlyerChatbot(job.flyer_id, onboarding);
}

export async function getMyOnboarding(userId: string): Promise<OnboardingSubmission | null> {
  const { data, error } = await supabase
    .from("onboarding_submissions" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as OnboardingSubmission | null) ?? null;
}

export async function getOnboardingForJob(jobId: string): Promise<OnboardingSubmission | null> {
  const { data, error } = await supabase
    .from("onboarding_submissions" as any)
    .select("*")
    .eq("flyer_job_id", jobId)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as OnboardingSubmission | null) ?? null;
}

async function uploadLogo(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/logos/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("flyer-assets").upload(path, file, {
    contentType: file.type || "image/png",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("flyer-assets").getPublicUrl(path).data.publicUrl;
}

async function uploadFlyer(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("job-uploads").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export interface SubmitOnboardingArgs {
  userId: string;
  userEmail: string | null | undefined;
  input: OnboardingInput;
  logoFile: File | null;
  flyerFile: File | null;
}

export async function submitOnboarding(args: SubmitOnboardingArgs): Promise<{ jobId: string | null }> {
  const { userId, userEmail, input, logoFile, flyerFile } = args;

  let logoUrl: string | null = input.logo_url ?? null;
  if (logoFile) logoUrl = await uploadLogo(userId, logoFile);

  let flyerPath: string | null = null;
  if (flyerFile) {
    flyerPath = await uploadFlyer(userId, flyerFile);
  }

  const title = input.business_name?.trim() || "Onboarding project";
  const existing = await getMyOnboarding(userId);
  let jobId: string | null = null;

  if (existing?.flyer_job_id && !flyerFile) {
    jobId = existing.flyer_job_id;
    const { error: jobUpdateErr } = await supabase
      .from("jobs")
      .update({
        title,
        brief: input.business_description || null,
        customer_email: userEmail ?? null,
      })
      .eq("id", jobId);
    if (jobUpdateErr) throw jobUpdateErr;
  } else {
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        customer_email: userEmail ?? null,
        type: flyerPath ? "upload" : "design",
        title,
        brief: input.business_description || null,
        upload_url: flyerPath,
        selected_actions: [],
        status: "new",
      })
      .select("id")
      .single();
    if (jobErr) throw jobErr;
    jobId = job?.id ?? null;
  }

  const row = {
    user_id: userId,
    full_name: input.full_name,
    phone: input.phone,
    email: input.email,
    business_name: input.business_name,
    business_address: input.business_address,
    business_slogan: input.business_slogan,
    business_description: input.business_description,
    website_url: input.website_url,
    website_help: input.website_help,
    facebook_url: input.facebook_url,
    instagram_url: input.instagram_url,
    tiktok_url: input.tiktok_url,
    other_social_url: input.other_social_url,
    social_help: input.social_help,
    logo_url: logoUrl,
    logo_help: input.logo_help,
    flyer_upload_url: flyerPath,
    flyer_job_id: jobId,
  };

  const { error: upsertErr } = await supabase
    .from("onboarding_submissions" as any)
    .upsert(row, { onConflict: "user_id" });
  if (upsertErr) throw upsertErr;

  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);

  if (jobId) {
    try {
      await syncOnboardingChatbotKnowledgeForJob(jobId);
    } catch (err) {
      console.warn("chatbot knowledge sync failed", err);
    }
  }

  // Fire smart-detect in the background (image files only). Do not block submission.
  if (jobId && flyerFile && flyerFile.type.startsWith("image/")) {
    (async () => {
      try {
        const { data: signed } = await supabase.storage
          .from("job-uploads")
          .createSignedUrl(flyerPath!, 600);
        if (!signed?.signedUrl) return;
        const { data } = await supabase.functions.invoke("smart-detect", {
          body: { imageUrl: signed.signedUrl },
        });
        if (data?.detections) {
          await supabase
            .from("onboarding_submissions" as any)
            .update({ hotspot_suggestions: data })
            .eq("user_id", userId);
        }
      } catch (err) {
        console.warn("smart-detect background run failed", err);
      }
    })();
  }

  return { jobId };
}
