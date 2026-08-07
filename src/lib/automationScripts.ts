import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type AutomationScriptRequest = {
  id: string;
  flyer_id: string;
  owner_id: string;
  status: string;
  custom_request: string | null;
  priority: string;
  due_date: string | null;
  facebook_post: string | null;
  instagram_caption: string | null;
  tiktok_caption: string | null;
  email_subject: string | null;
  email_body: string | null;
  sms_body: string | null;
  video_script: string | null;
  staff_notes: string | null;
  fulfilled_at: string | null;
  sheet_row: number | null;
  sheet_synced_at: string | null;
  sheet_error: string | null;
  created_at: string;
  updated_at: string;
};

export const AUTOMATION_STATUSES = ["requested", "drafted", "in_progress", "fulfilled"] as const;

export async function loadAutomationRequests(flyerId: string) {
  const { data, error } = await supabase
    .from("automation_script_requests")
    .select("*")
    .eq("flyer_id", flyerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomationScriptRequest[];
}

export async function createAutomationRequest(input: {
  flyerId: string;
  ownerId: string;
  customRequest: string;
  priority: string;
  dueDate?: string | null;
}) {
  const { data, error } = await supabase
    .from("automation_script_requests")
    .insert([
      {
        flyer_id: input.flyerId,
        owner_id: input.ownerId,
        custom_request: input.customRequest || null,
        priority: input.priority,
        due_date: input.dueDate || null,
      },
    ])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AutomationScriptRequest;
}

export async function updateAutomationRequest(
  id: string,
  patch: Partial<AutomationScriptRequest>,
) {
  const { data, error } = await supabase
    .from("automation_script_requests")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AutomationScriptRequest;
}

export async function deleteAutomationRequest(id: string) {
  const { error } = await supabase.from("automation_script_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Ask the AI to draft channel scripts for this request (saves onto the row). */
export async function generateAutomationScripts(requestId: string) {
  return invokeEdgeFunction<{ request: AutomationScriptRequest }>("automation-scripts", {
    action: "generate",
    requestId,
  });
}

/** Append/update the master Google Sheet row for this request. */
export async function syncAutomationRequestToSheet(requestId: string) {
  return invokeEdgeFunction<{ request: AutomationScriptRequest; skipped?: string }>(
    "automation-scripts",
    { action: "sync", requestId },
  );
}
