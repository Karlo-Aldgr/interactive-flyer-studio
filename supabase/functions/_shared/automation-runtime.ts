export const MAX_AUTOMATION_CHAIN_DEPTH = 10;

export type JsonObject = Record<string, unknown>;
export type Condition = { field: string; operator: string; value?: unknown };
export type ConditionGroup = { match: "all" | "any"; items: Condition[] };
export type ChainContext = { correlationId: string; depth: number; visitedAutomationIds: string[] };

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : null;

export function resolveConditionValue(field: string, event: JsonObject): unknown {
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata as JsonObject : {};
  const actor = event.actor && typeof event.actor === "object" ? event.actor as JsonObject : {};
  const values: Record<string, unknown> = {
    flyer_id: event.flyer_id,
    flyer_category: metadata.flyer_category,
    city: metadata.city ?? actor.city,
    state: metadata.state ?? actor.state,
    date: metadata.date ?? event.occurred_at,
    time: metadata.time ?? event.occurred_at,
    lead_email: actor.email ?? metadata.email,
    lead_phone: actor.phone ?? metadata.phone,
    ticket_type: metadata.ticket_type,
    hotspot_id: metadata.hotspot_id ?? metadata.interaction_id,
  };
  return values[field];
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compare(condition: Condition, actual: unknown): boolean {
  const expected = condition.value;
  if (condition.operator === "exists") return hasText(actual);
  if (condition.operator === "not_exists") return !hasText(actual);
  if (actual === undefined || actual === null) return false;

  if (condition.field === "date") {
    const left = validDate(String(actual).slice(0, 10));
    const right = validDate(String(expected).slice(0, 10));
    if (!left || !right) return false;
    if (condition.operator === "equals") return left.getTime() === right.getTime();
    if (condition.operator === "before") return left < right;
    if (condition.operator === "after") return left > right;
    return false;
  }
  if (condition.field === "time") {
    const normalize = (value: unknown) => {
      const text = stringValue(value);
      if (!text) return null;
      const time = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(text);
      if (time) return Number(time[1]) * 60 + Number(time[2]);
      const date = validDate(text);
      return date ? date.getUTCHours() * 60 + date.getUTCMinutes() : null;
    };
    const left = normalize(actual);
    const right = normalize(expected);
    if (left === null || right === null) return false;
    if (condition.operator === "before") return left < right;
    if (condition.operator === "after") return left > right;
    return condition.operator === "equals" && left === right;
  }

  const left = stringValue(actual);
  const right = stringValue(expected);
  if (left === null || right === null) return false;
  const normalizeText = ["city", "state", "flyer_category", "ticket_type"].includes(condition.field);
  const a = normalizeText ? left.toLocaleLowerCase() : left;
  const b = normalizeText ? right.toLocaleLowerCase() : right;
  if (condition.operator === "equals") return a === b;
  if (condition.operator === "not_equals") return a !== b;
  if (condition.operator === "contains") return a.includes(b);
  if (condition.operator === "not_contains") return !a.includes(b);
  return false;
}

export function evaluateConditions(group: ConditionGroup, event: JsonObject): boolean {
  if (!group || !Array.isArray(group.items)) return false;
  if (group.items.length === 0) return true;
  const results = group.items.map((condition) => compare(condition, resolveConditionValue(condition.field, event)));
  return group.match === "all" ? results.every(Boolean) : group.match === "any" ? results.some(Boolean) : false;
}

export function matchesTrigger(triggerType: string, eventType: unknown): boolean {
  return typeof eventType === "string" && triggerType === eventType;
}

export function checkChainTarget(context: ChainContext, targetAutomationId: string): { allowed: boolean; code?: string; next?: ChainContext } {
  if (context.depth >= MAX_AUTOMATION_CHAIN_DEPTH) return { allowed: false, code: "max_chain_depth" };
  if (context.visitedAutomationIds.includes(targetAutomationId)) return { allowed: false, code: "loop_prevented" };
  return {
    allowed: true,
    next: {
      correlationId: context.correlationId,
      depth: context.depth + 1,
      visitedAutomationIds: [...context.visitedAutomationIds, targetAutomationId],
    },
  };
}

export function redactForLog(value: unknown): unknown {
  const secret = /(authorization|token|secret|password|api[_-]?key|service[_-]?role|credential|payment)/i;
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonObject).map(([key, item]) => [key, secret.test(key) ? "[REDACTED]" : redactForLog(item)]));
  }
  if (typeof value === "string" && value.length > 1000) return `${value.slice(0, 1000)}…`;
  return value;
}

export function safeDeliveryUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export type RuntimeAutomation = {
  id: string;
  account_id: string;
  status: string;
  published_version_id: string | null;
  trigger_type: string;
};

export function selectEligibleAutomations(automations: RuntimeAutomation[], accountId: string, eventType: string) {
  return automations.filter((automation) =>
    automation.account_id === accountId && automation.status === "active" &&
    !!automation.published_version_id && automation.trigger_type === eventType
  );
}

export async function runOrderedSteps<T extends { key: string }>(
  steps: T[],
  handler: (step: T, position: number) => Promise<{ ok: boolean; code?: string }>,
) {
  const results: Array<{ key: string; status: "succeeded" | "failed" | "skipped"; code?: string }> = [];
  let stopped = false;
  for (let position = 0; position < steps.length; position++) {
    const step = steps[position];
    if (stopped) {
      results.push({ key: step.key, status: "skipped", code: "prior_step_failed" });
      continue;
    }
    const result = await handler(step, position);
    results.push({ key: step.key, status: result.ok ? "succeeded" : "failed", code: result.code });
    if (!result.ok) stopped = true;
  }
  return results;
}
