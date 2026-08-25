import { supabase } from "@/integrations/supabase/client";
import { buildPublicPortalUrl } from "@/lib/utils";
import { loadUserJobs, type UserJob } from "@/lib/userJobs";

export function isJobPortalReady(job: UserJob): boolean {
  return (
    !!job.flyer_id &&
    (!!job.share_unlocked || ["paid", "completed", "delivered"].includes(job.status))
  );
}

export async function loadCustomerPortalJobs(userId: string): Promise<UserJob[]> {
  const { jobs, error } = await loadUserJobs(userId);
  if (error) throw new Error(error.message || "Could not load projects");
  return jobs.filter(isJobPortalReady);
}

export async function fetchCustomerPortalUrl(flyerId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("portal-access", {
    body: { action: "customer_link", flyer_id: flyerId },
  });
  if (error) throw new Error(error.message);
  const res = data as { error?: string; portal_token?: string; portal_access_code?: string } | null;
  if (res?.error) throw new Error(res.error);
  if (!res?.portal_token || !res?.portal_access_code) return null;
  return buildPublicPortalUrl(res.portal_token, res.portal_access_code);
}
