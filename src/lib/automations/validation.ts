import { z } from "zod";
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_CONDITION_FIELDS,
  AUTOMATION_CONDITION_OPERATORS,
  AUTOMATION_TRIGGER_TYPES,
  type AutomationDefinition,
} from "./types";

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const nonEmptyText = z.string().trim().min(1).max(4000);
const actionConfigSchemas: Partial<Record<(typeof AUTOMATION_ACTION_TYPES)[number], z.ZodTypeAny>> = {
  send_email: z.object({ subject: nonEmptyText.max(200), body: nonEmptyText }),
  send_sms: z.object({ message: nonEmptyText.max(1600) }),
  show_popup: z.object({ title: nonEmptyText.max(200), message: nonEmptyText }),
  send_notification: z.object({ title: nonEmptyText.max(200), message: nonEmptyText }),
  add_tag: z.object({ tag: nonEmptyText.max(100) }),
  remove_tag: z.object({ tag: nonEmptyText.max(100) }),
  save_contact_activity: z.object({ description: nonEmptyText.max(1000) }),
  send_appointment_confirmation: z.object({ subject: nonEmptyText.max(200), message: nonEmptyText }),
  send_ticket_confirmation: z.object({ subject: nonEmptyText.max(200), message: nonEmptyText }),
  open_url: z.object({ url: z.string().trim().url().max(2000) }),
  continue_workflow: z.object({ targetAutomationId: z.string().uuid() }),
  wait: z.object({ seconds: z.number().int().min(1).max(31_536_000) }),
};

export const automationConditionSchema = z.object({
  id: z.string().min(1).max(100),
  field: z.enum(AUTOMATION_CONDITION_FIELDS),
  operator: z.enum(AUTOMATION_CONDITION_OPERATORS),
  value: jsonValueSchema.optional(),
});

export const automationStepSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["action", "wait", "condition", "workflow"]),
  actionType: z.enum(AUTOMATION_ACTION_TYPES).optional(),
  config: z.record(jsonValueSchema),
  nextStepKey: z.string().min(1).max(100).optional(),
  onTrueStepKey: z.string().min(1).max(100).optional(),
  onFalseStepKey: z.string().min(1).max(100).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().int().min(1).max(100),
    backoffSeconds: z.number().int().min(0).max(2_592_000).optional(),
  }).optional(),
}).superRefine((step, context) => {
  if (step.type === "action" && !step.actionType) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["actionType"], message: "Action steps require an action type" });
  }
  if (step.actionType) {
    const schema = actionConfigSchemas[step.actionType];
    const result = schema?.safeParse(step.config);
    if (result && !result.success) {
      result.error.issues.forEach((issue) => context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["config", ...issue.path],
        message: issue.message,
      }));
    }
  }
});

export const automationDefinitionSchema = z.object({
  conditions: z.object({
    match: z.enum(["all", "any"]),
    items: z.array(automationConditionSchema).max(50),
  }),
  steps: z.array(automationStepSchema).max(100),
}).superRefine((definition, context) => {
  const keys = new Set<string>();
  definition.steps.forEach((step, index) => {
    if (keys.has(step.key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["steps", index, "key"], message: "Step keys must be unique" });
    }
    keys.add(step.key);
  });
  definition.steps.forEach((step, index) => {
    for (const field of ["nextStepKey", "onTrueStepKey", "onFalseStepKey"] as const) {
      const target = step[field];
      if (target && !keys.has(target)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["steps", index, field], message: `Unknown step: ${target}` });
      }
    }
  });
});

export const automationTriggerTypeSchema = z.enum(AUTOMATION_TRIGGER_TYPES);

export function validateAutomationDefinition(value: unknown): AutomationDefinition {
  return automationDefinitionSchema.parse(value) as AutomationDefinition;
}
