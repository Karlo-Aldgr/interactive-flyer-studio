import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_AUTOMATION_DEFINITION,
  type Automation,
  type AutomationStep,
  type AutomationVersion,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from "./types";
import { automationTriggerTypeSchema, validateAutomationDefinition } from "./validation";

// The generated Supabase types are updated after the migration is applied to
// the linked project. Keep the cast local so the rest of the application stays typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
  if (input.draft_definition !== undefined) {
    patch.draft_definition = validateAutomationDefinition(input.draft_definition);
  }
  delete patch.account_id;
  delete patch.flyer_id;
  delete patch.created_by;
  delete patch.published_version_id;
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
  const { data, error } = await db.from("automations").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as Automation;
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
