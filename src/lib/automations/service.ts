import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_AUTOMATION_DEFINITION,
  type Automation,
  type AutomationStep,
  type AutomationVersion,
  type AutomationFlyerOption,
  type CreateAutomationInput,
  type UpdateAutomationInput,
  type AutomationExecutionHistory,
  type AutomationHistoryFilters,
} from "./types";
import { safeAutomationError, sanitizeAutomationHistory } from "./history";
import { automationTriggerTypeSchema, validateAutomationDefinition } from "./validation";

// The generated Supabase types are updated after the migration is applied to
// the linked project. Keep the cast local so the rest of the application stays typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type RawHistoryStep = {
  id: string; step_key: string; attempt: number; status: AutomationExecutionHistory["steps"][number]["status"];
  output: unknown; error_code: unknown; error_message: unknown; started_at: string | null; completed_at: string | null;
  automation_steps: { position: number; action_type: AutomationExecutionHistory["steps"][number]["action_type"] } | null;
};
type RawHistoryRow = {
  id: string; automation_id: string; status: AutomationExecutionHistory["status"]; correlation_id: string;
  output: unknown; error_code: unknown; error_message: unknown; started_at: string | null; completed_at: string | null; created_at: string;
  automations: { name: string; trigger_type: AutomationExecutionHistory["trigger_type"] };
  automation_versions: { version: number }; automation_events: { event_type: string } | null;
  automation_step_executions: RawHistoryStep[];
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in required");
  return data.user.id;
}

export async function listAutomations(flyerId?: string): Promise<Automation[]> {
  let query = db.from("automations").select("*").order("updated_at", { ascending: false });
  if (flyerId) query = query.eq("flyer_id", flyerId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Automation[];
}

export async function getAutomation(id: string): Promise<Automation | null> {
  const { data, error } = await db.from("automations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Automation | null) ?? null;
}

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  const userId = await requireUserId();
  const definition = validateAutomationDefinition(input.definition ?? EMPTY_AUTOMATION_DEFINITION);
  const triggerType = automationTriggerTypeSchema.parse(input.triggerType);
  const row = {
    // account_id is intentionally omitted; the database derives it.
    flyer_id: input.flyerId ?? null,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    trigger_type: triggerType,
    trigger_config: input.triggerConfig ?? {},
    draft_definition: definition,
    created_by: userId,
    updated_by: userId,
  };
  const { data, error } = await db.from("automations").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as Automation;
}

export async function updateAutomation(id: string, input: UpdateAutomationInput): Promise<Automation> {
  const userId = await requireUserId();
  const patch: Record<string, unknown> = { ...input, updated_by: userId };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.trigger_type !== undefined) patch.trigger_type = automationTriggerTypeSchema.parse(input.trigger_type);
  if (input.flyer_id !== undefined) patch.flyer_id = input.flyer_id;
  if (input.draft_definition !== undefined) {
    patch.draft_definition = validateAutomationDefinition(input.draft_definition);
  }
  delete patch.account_id;
  delete patch.created_by;
  delete patch.published_version_id;
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
  const { data, error } = await db.from("automations").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as Automation;
}

export async function activateAutomation(id: string): Promise<Automation> {
  await publishAutomation(id);
  return updateAutomation(id, { status: "active" });
}

export async function pauseAutomation(id: string): Promise<Automation> {
  return updateAutomation(id, { status: "paused" });
}

export async function duplicateAutomation(source: Automation): Promise<Automation> {
  return createAutomation({
    flyerId: source.flyer_id,
    name: `${source.name} (copy)`,
    description: source.description,
    triggerType: source.trigger_type,
    triggerConfig: source.trigger_config,
    definition: source.draft_definition,
  });
}

export async function listAutomationFlyers(): Promise<AutomationFlyerOption[]> {
  const { data, error } = await supabase
    .from("flyers")
    .select("id, title, category, status")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomationFlyerOption[];
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await db.from("automations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function publishAutomation(id: string): Promise<string> {
  validateAutomationDefinition((await getAutomation(id))?.draft_definition);
  const { data, error } = await db.rpc("publish_automation", { _automation_id: id });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function listAutomationVersions(automationId: string): Promise<AutomationVersion[]> {
  const { data, error } = await db
    .from("automation_versions")
    .select("*")
    .eq("automation_id", automationId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomationVersion[];
}

export async function listAutomationSteps(versionId: string): Promise<AutomationStep[]> {
  const { data, error } = await db
    .from("automation_steps")
    .select("*")
    .eq("version_id", versionId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomationStep[];
}

export async function listAutomationHistory(filters: AutomationHistoryFilters = {}): Promise<{ rows: AutomationExecutionHistory[]; count: number }> {
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const page = Math.max(1, filters.page ?? 1);
  const fromIndex = (page - 1) * pageSize;
  let query = db.from("automation_executions").select(
    "id, automation_id, status, correlation_id, output, error_code, error_message, started_at, completed_at, created_at, automations!inner(name, trigger_type), automation_versions!inner(version), automation_events(event_type), automation_step_executions(id, step_key, attempt, status, output, error_code, error_message, started_at, completed_at, automation_steps(position, action_type))",
    { count: "exact" },
  ).order("created_at", { ascending: false }).range(fromIndex, fromIndex + pageSize - 1);
  if (filters.automationId) query = query.eq("automation_id", filters.automationId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as RawHistoryRow[]).map((row) => {
    const executionError = safeAutomationError(row.error_code, row.error_message);
    return {
      id: row.id,
      automation_id: row.automation_id,
      automation_name: row.automations.name,
      version: row.automation_versions.version,
      trigger_type: row.automations.trigger_type,
      event_type: row.automation_events?.event_type ?? null,
      status: row.status,
      correlation_id: row.correlation_id,
      output: sanitizeAutomationHistory(row.output),
      error_code: executionError.code,
      error_message: executionError.message,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      steps: (row.automation_step_executions ?? []).map((step) => {
        const stepError = safeAutomationError(step.error_code, step.error_message);
        return {
          id: step.id,
          step_key: step.step_key,
          position: step.automation_steps?.position ?? null,
          action_type: step.automation_steps?.action_type ?? null,
          attempt: step.attempt,
          status: step.status,
          output: sanitizeAutomationHistory(step.output),
          error_code: stepError.code,
          error_message: stepError.message,
          started_at: step.started_at,
          completed_at: step.completed_at,
        };
      }).sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.attempt - b.attempt),
    } as AutomationExecutionHistory;
  });
  return { rows, count: count ?? 0 };
}
