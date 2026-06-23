import { supabase } from "@/integrations/supabase/client";

type RpcResult = { ok?: boolean; error?: string } | null;

function parseRpc(data: unknown, error: { message: string } | null) {
  if (error) return { ok: false as const, error: error.message };
  const result = data as RpcResult;
  if (!result?.ok) return { ok: false as const, error: result?.error ?? "Request failed" };
  return { ok: true as const, error: null };
}

export async function customerDeleteJob(jobId: string, reason: string) {
  const { data, error } = await supabase.rpc("customer_delete_job", {
    _job_id: jobId,
    _reason: reason,
  });
  return parseRpc(data, error);
}

export async function customerSetFlyerActive(jobId: string, active: boolean) {
  const { data, error } = await supabase.rpc("customer_set_flyer_active" as any, {
    _job_id: jobId,
    _active: active,
  });
  return parseRpc(data, error);
}

export type CustomerJobUpdate = {
  title?: string;
  brief?: string | null;
  selectedActions?: string[];
  uploadUrl?: string | null;
};

export async function customerUpdateJob(jobId: string, patch: CustomerJobUpdate) {
  const params: {
    _job_id: string;
    _title?: string;
    _brief?: string | null;
    _selected_actions?: string[];
    _upload_url?: string | null;
  } = { _job_id: jobId };

  if (patch.title !== undefined) params._title = patch.title;
  if (patch.brief !== undefined) params._brief = patch.brief;
  if (patch.selectedActions !== undefined) params._selected_actions = patch.selectedActions;
  if (patch.uploadUrl !== undefined) params._upload_url = patch.uploadUrl;

  const { data, error } = await supabase.rpc("customer_update_job", params);
  return parseRpc(data, error);
}

export async function staffAcknowledgeJob(jobId: string) {
  const { data, error } = await supabase.rpc("staff_acknowledge_job", { _job_id: jobId });
  return parseRpc(data, error);
}

export async function staffMarkJobSeen(jobId: string) {
  const { data, error } = await supabase.rpc("staff_mark_job_seen", { _job_id: jobId });
  return parseRpc(data, error);
}

/** Red dot when customer edited after staff last opened the job. */
export function jobHasCustomerUpdate(job: {
  customer_updated_at?: string | null;
  staff_content_seen_at?: string | null;
  created_at: string;
}) {
  if (!job.customer_updated_at) return false;
  if (!job.staff_content_seen_at) {
    return new Date(job.customer_updated_at) > new Date(job.created_at);
  }
  return new Date(job.customer_updated_at) > new Date(job.staff_content_seen_at);
}

export function jobIsCustomerDeleted(job: { deleted_at?: string | null }) {
  return !!job.deleted_at;
}

export function customerCanEditJob(job: {
  deleted_at?: string | null;
  status: string;
}) {
  if (job.deleted_at) return false;
  return !["delivered", "cancelled"].includes(job.status);
}

export function customerCanDeleteJob(job: {
  deleted_at?: string | null;
  status: string;
}) {
  if (job.deleted_at) return false;
  return job.status !== "delivered";
}
