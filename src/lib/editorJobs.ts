import { supabase } from "@/integrations/supabase/client";
import type { JobStatus } from "@/lib/jobStatus";

/** Statuses editors may set (billing/admin steps stay on admin). */
export const EDITOR_JOB_STATUSES: JobStatus[] = [
  "reviewing",
  "in_progress",
  "preview_ready",
  "delivered",
];

export const EDITOR_STATUS_LABEL: Record<string, string> = {
  reviewing: "Reviewing",
  in_progress: "In progress",
  preview_ready: "Preview ready",
  delivered: "Completed",
};

export type EditorJobUpdate = {
  status?: JobStatus;
  flyerId?: string | null;
  previewReady?: boolean;
  clearFlyer?: boolean;
};

export async function updateEditorJob(jobId: string, patch: EditorJobUpdate) {
  const params: {
    _job_id: string;
    _status?: JobStatus;
    _flyer_id?: string | null;
    _preview_ready?: boolean;
    _clear_flyer?: boolean;
  } = { _job_id: jobId };

  if (patch.status !== undefined) params._status = patch.status;
  if (patch.previewReady !== undefined) params._preview_ready = patch.previewReady;
  if (patch.clearFlyer) {
    params._clear_flyer = true;
  } else if (patch.flyerId !== undefined) {
    params._flyer_id = patch.flyerId;
  }

  const { data, error } = await supabase.rpc("editor_update_job", params);

  if (error) return { ok: false as const, error: error.message };

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { ok: false as const, error: result?.error ?? "Update failed" };
  }

  return { ok: true as const, error: null };
}
