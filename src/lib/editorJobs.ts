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

export async function claimEditorJob(jobId: string) {
  const { data, error } = await supabase.rpc("editor_claim_job", { _job_id: jobId });
  if (error) return { ok: false as const, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false as const, error: result?.error ?? "Could not claim job" };
  return { ok: true as const, error: null };
}

export async function releaseEditorJob(jobId: string) {
  const { data, error } = await supabase.rpc("editor_release_job", { _job_id: jobId });
  if (error) return { ok: false as const, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false as const, error: result?.error ?? "Could not release" };
  return { ok: true as const, error: null };
}

export async function adminAssignJobEditor(jobId: string, editorId: string | null) {
  const { data, error } = await supabase.rpc("admin_assign_job_editor", {
    _job_id: jobId,
    _editor_id: editorId,
  });
  if (error) return { ok: false as const, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false as const, error: result?.error ?? "Could not assign" };
  return { ok: true as const, error: null };
}

/** Resolve assigned editor display names (emails) in batch via the SECURITY DEFINER helper. */
export async function fetchEditorDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  await Promise.all(
    unique.map(async (uid) => {
      const { data } = await supabase.rpc("job_assigned_editor_display", { _user_id: uid });
      if (typeof data === "string" && data.length > 0) map.set(uid, data);
    })
  );
  return map;
}
