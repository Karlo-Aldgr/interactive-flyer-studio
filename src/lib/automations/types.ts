export const AUTOMATION_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const AUTOMATION_TRIGGER_TYPES = [
  "flyer_viewed",
  "flyer_tapped",
  "hotspot_clicked",
  "qr_scanned",
  "form_submitted",
  "contact_form_submitted",
  "website_form_submitted",
  "lead_created",
  "appointment_booked",
  "appointment_request_submitted",
  "ticket_purchase_completed",
  "flyer_shared",
  "bizad_viewed",
  "bizad_action_clicked",
  "date_time_reached",
  "customer_action_completed",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = [
  "show_popup",
  "open_url",
  "open_internal_page",
  "open_bizad",
  "open_phone_dialer",
  "open_email",
  "open_sms",
  "send_sms",
  "save_lead",
  "create_lead",
  "update_lead",
  "add_tag",
  "remove_tag",
  "save_contact_activity",
  "send_notification",
  "send_email",
  "send_appointment_confirmation",
  "send_ticket_confirmation",
  "trigger_webhook",
  "update_record",
  "wait",
  "continue_workflow",
] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const AUTOMATION_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "exists",
  "not_exists",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "before",
  "after",
  "in",
  "not_in",
] as const;
export type AutomationConditionOperator = (typeof AUTOMATION_CONDITION_OPERATORS)[number];

export const AUTOMATION_CONDITION_FIELDS = [
  "flyer_id",
  "flyer_category",
  "city",
  "state",
  "date",
  "time",
  "lead_email",
  "lead_phone",
  "ticket_type",
  "hotspot_id",
] as const;
export type AutomationConditionField = (typeof AUTOMATION_CONDITION_FIELDS)[number];

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface AutomationCondition {
  id: string;
  field: AutomationConditionField;
  operator: AutomationConditionOperator;
  value?: JsonValue;
}

export interface AutomationConditionGroup {
  match: "all" | "any";
  items: AutomationCondition[];
}

export interface AutomationRetryPolicy {
  maxAttempts: number;
  backoffSeconds?: number;
}

export interface AutomationStepDefinition {
  key: string;
  type: "action" | "wait" | "condition" | "workflow";
  actionType?: AutomationActionType;
  config: JsonObject;
  nextStepKey?: string;
  onTrueStepKey?: string;
  onFalseStepKey?: string;
  retryPolicy?: AutomationRetryPolicy;
}

export interface AutomationDefinition {
  conditions: AutomationConditionGroup;
  steps: AutomationStepDefinition[];
}

export interface Automation {
  id: string;
  account_id: string;
  flyer_id: string | null;
  name: string;
  description: string | null;
  status: AutomationStatus;
  trigger_type: AutomationTriggerType;
  trigger_config: JsonObject;
  draft_definition: AutomationDefinition;
  draft_revision: number;
  published_version_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationVersion {
  id: string;
  account_id: string;
  automation_id: string;
  version: number;
  trigger_type: AutomationTriggerType;
  trigger_config: JsonObject;
  definition: AutomationDefinition;
  published_by: string;
  published_at: string;
}

export interface AutomationStep {
  id: string;
  account_id: string;
  automation_id: string;
  version_id: string;
  step_key: string;
  position: number;
  step_type: AutomationStepDefinition["type"];
  action_type: AutomationActionType | null;
  config: JsonObject;
  next_step_key: string | null;
  on_true_step_key: string | null;
  on_false_step_key: string | null;
  retry_policy: AutomationRetryPolicy;
  created_at: string;
}

export const EMPTY_AUTOMATION_DEFINITION: AutomationDefinition = {
  conditions: { match: "all", items: [] },
  steps: [],
};

export type CreateAutomationInput = {
  flyerId?: string | null;
  name: string;
  description?: string | null;
  triggerType: AutomationTriggerType;
  triggerConfig?: JsonObject;
  definition?: AutomationDefinition;
};

export type UpdateAutomationInput = Partial<
  Pick<Automation, "name" | "description" | "status" | "trigger_type" | "trigger_config" | "draft_definition">
> & { flyer_id?: string | null };

export type AutomationFlyerOption = {
  id: string;
  title: string;
  category: string;
  status: string;
};

export const AUTOMATION_EXECUTION_STATUSES = ["pending", "running", "waiting", "succeeded", "failed", "cancelled"] as const;
export type AutomationExecutionStatus = (typeof AUTOMATION_EXECUTION_STATUSES)[number];

export interface AutomationExecutionStepHistory {
  id: string;
  step_key: string;
  position: number | null;
  action_type: AutomationActionType | null;
  attempt: number;
  status: "pending" | "running" | "waiting" | "succeeded" | "failed" | "skipped" | "cancelled";
  output: JsonValue | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AutomationExecutionHistory {
  id: string;
  automation_id: string;
  automation_name: string;
  version: number;
  trigger_type: AutomationTriggerType;
  event_type: string | null;
  status: AutomationExecutionStatus;
  correlation_id: string;
  output: JsonValue | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  steps: AutomationExecutionStepHistory[];
}

export type AutomationHistoryFilters = {
  automationId?: string;
  status?: AutomationExecutionStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};
