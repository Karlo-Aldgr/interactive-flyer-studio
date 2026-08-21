import { supabase } from "@/integrations/supabase/client";
import type { SocialPlatform } from "./types";

export type BulkResult = {
  job_id: string;
  job_title?: string;
  post_id?: string;
  platform?: SocialPlatform;
  variant_id?: string;
  ok: boolean;
  message?: string;
  code?: string;
  remote_post_url?: string | null;
};

export type BulkResponse = {
  ok: boolean;
  projects: number;
  accounts: number;
  published: number;
  failed: number;
  results: BulkResult[];
};

/** Server-side fan-out: ownership of both projects and accounts is re-verified there. */
export async function bulkPostToSocials(jobIds: string[], accountIds: string[]) {
  const { data, error } = await supabase.functions.invoke("social-bulk-publish", {
    body: { job_ids: jobIds, account_ids: accountIds },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as BulkResponse;
}
