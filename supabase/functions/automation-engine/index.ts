import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  checkChainTarget,
  automationEventIdempotencyKey,
  evaluateConditions,
  matchesTrigger,
  isAutomationRateLimited,
  redactForLog,
  safeDeliveryUrl,
  validAutomationEventEnvelope,
  validAutomationEventTime,
  type ChainContext,
  type JsonObject,
} from "../_shared/automation-runtime.ts";
import { createAutomationProviderRegistry, type AutomationActionResult } from "../_shared/automation-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const EVENT_TYPES = new Set([
  "flyer_viewed", "flyer_tapped", "hotspot_clicked", "form_submitted", "contact_form_submitted",
  "appointment_request_submitted", "bizad_viewed", "bizad_action_clicked", "lead_created",
  "qr_scanned", "website_form_submitted", "ticket_purchase_completed",
]);
const EVENT_SOURCE: Record<string, EventRequest["sourceType"] | null> = {
  flyer_viewed: "flyer", flyer_tapped: "flyer", hotspot_clicked: "flyer",
  form_submitted: "form_submission", contact_form_submitted: "form_submission", website_form_submitted: "form_submission",
  lead_created: "subscriber",
  appointment_request_submitted: "appointment",
  bizad_viewed: "bizad", bizad_action_clicked: "bizad",
  qr_scanned: "qr", ticket_purchase_completed: null,
};
const PROVIDER_ADAPTERS = createAutomationProviderRegistry();

type EventRequest = {
  eventType: string;
  sourceType: "flyer" | "bizad" | "appointment" | "subscriber" | "form_submission" | "qr";
  sourceId: string;
  flyerId?: string;
  clientEventId: string;
  occurredAt?: string;
  actor?: JsonObject;
  metadata?: JsonObject;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function cleanActor(actor: JsonObject | undefined): JsonObject {
  if (!actor) return {};
  const result: JsonObject = {};
  for (const key of ["email", "phone", "city", "state", "name"]) {
    const value = actor[key];
    if (typeof value === "string" && value.length <= 320) result[key] = value.trim();
  }
  return result;
}

function cleanMetadata(metadata: JsonObject | undefined): JsonObject {
  if (!metadata) return {};
  const result: JsonObject = {};
  for (const key of ["flyer_category", "city", "state", "date", "time", "ticket_type", "hotspot_id", "interaction_id", "action_type", "page_id", "layer_id"]) {
    const value = metadata[key];
    if (["string", "number", "boolean"].includes(typeof value) && String(value).length <= 500) result[key] = value;
  }
  return result;
}

async function resolveTrustedSource(db: any, input: EventRequest) {
  let flyerId: string | null = null;
  const sourceId = input.sourceId;
  let trustedActor: JsonObject = {};
  let trustedMetadata: JsonObject = {};
  if (input.sourceType === "flyer") flyerId = input.sourceId;
  if (input.sourceType === "bizad") {
    const { data } = await db.from("bizads").select("id, flyer_id, enabled").eq("id", input.sourceId).maybeSingle();
    if (!data?.enabled) throw new Error("unknown_source");
    flyerId = data.flyer_id;
  }
  if (input.sourceType === "appointment") {
    const { data } = await db.from("appointments").select("id, flyer_id, layer_id, action_id, name, email, phone").eq("id", input.sourceId).maybeSingle();
    if (!data) throw new Error("unknown_source");
    flyerId = data.flyer_id;
    trustedActor = cleanActor({ name: data.name, email: data.email, phone: data.phone });
    trustedMetadata = { hotspot_id: data.layer_id || "", interaction_id: data.action_id || "" };
  }
  if (input.sourceType === "subscriber") {
    const { data } = await db.from("subscribers").select("id, flyer_id, name, email, phone").eq("id", input.sourceId).maybeSingle();
    if (!data) throw new Error("unknown_source");
    flyerId = data.flyer_id;
    trustedActor = cleanActor({ name: data.name, email: data.email, phone: data.phone });
  }
  if (input.sourceType === "form_submission") {
    const { data } = await db.from("form_submissions").select("id, flyer_id, layer_id, data").eq("id", input.sourceId).maybeSingle();
    if (!data) throw new Error("unknown_source");
    flyerId = data.flyer_id;
    const submitted = data.data && typeof data.data === "object" ? data.data as JsonObject : {};
    const customer = submitted.customer && typeof submitted.customer === "object" ? submitted.customer as JsonObject : submitted;
    trustedActor = cleanActor(customer);
    trustedMetadata = { hotspot_id: data.layer_id || "", form_kind: typeof submitted._preset === "string" ? submitted._preset : "form" };
  }
  if (input.sourceType === "qr") {
    const { data } = await db.from("flyers").select("id").eq("public_slug", input.sourceId).maybeSingle();
    if (!data) throw new Error("unknown_source");
    flyerId = data.id;
  }
  if (!flyerId) throw new Error("unknown_source");
  const { data: flyer } = await db.from("flyers").select("id, owner_id, category, status").eq("id", flyerId).maybeSingle();
  if (!flyer?.owner_id || flyer.status !== "published") throw new Error("source_not_public");
  return { accountId: flyer.owner_id as string, flyerId: flyer.id as string, flyerCategory: flyer.category, sourceId, trustedActor, trustedMetadata };
}

async function executeAction(db: any, actionType: string, config: JsonObject, event: JsonObject, accountId: string, deliveries: JsonObject[], correlationId: string, idempotencyKey: string): Promise<AutomationActionResult> {
  const providerAdapter = PROVIDER_ADAPTERS[actionType];
  if (providerAdapter) return providerAdapter(config, event, { accountId, correlationId, idempotencyKey });
  const actor = event.actor as JsonObject;
  const flyerId = event.flyer_id as string;
  if (actionType === "show_popup") {
    const title = typeof config.title === "string" ? config.title.slice(0, 200) : "";
    const message = typeof config.message === "string" ? config.message.slice(0, 4000) : "";
    if (!message) return { ok: false, code: "invalid_action_config" };
    deliveries.push({ type: "show_popup", title, message });
    return { ok: true, output: { delivery: "client" } };
  }
  if (actionType === "open_url") {
    const url = safeDeliveryUrl(config.url);
    if (!url) return { ok: false, code: "unsafe_url" };
    deliveries.push({ type: "open_url", url });
    return { ok: true, output: { delivery: "client" } };
  }
  if (actionType === "create_lead" || actionType === "save_lead") {
    const email = typeof actor.email === "string" ? actor.email.toLowerCase() : "";
    if (!email) return { ok: false, code: "lead_email_required" };
    const names = typeof actor.name === "string" ? actor.name.trim().split(/\s+/) : [];
    const leadRow = {
      client_id: accountId, flyer_id: flyerId, email, phone: actor.phone || null,
      first_name: names.shift() || null, last_name: names.join(" ") || null,
      source: "automation", status: "active",
    };
    const { data: existing } = await db.from("marketing_subscribers").select("id")
      .eq("client_id", accountId).ilike("email", email).maybeSingle();
    const operation = existing
      ? db.from("marketing_subscribers").update(leadRow).eq("id", existing.id).eq("client_id", accountId).select("id").single()
      : db.from("marketing_subscribers").insert(leadRow).select("id").single();
    const { data, error } = await operation;
    return error ? { ok: false, code: "lead_write_failed" } : { ok: true, output: { lead_id: data.id } };
  }
  if (["update_lead", "add_tag", "remove_tag"].includes(actionType)) {
    const leadId = typeof event.trusted_lead_id === "string" ? event.trusted_lead_id : null;
    if (!leadId) return { ok: false, code: "trusted_lead_required" };
    const { data: lead } = await db.from("marketing_subscribers").select("id, tags").eq("id", leadId).eq("client_id", accountId).maybeSingle();
    if (!lead) return { ok: false, code: "lead_not_found" };
    let patch: JsonObject = {};
    if (actionType === "update_lead") patch = {
      ...(typeof actor.phone === "string" ? { phone: actor.phone } : {}),
      ...(typeof actor.email === "string" ? { email: actor.email.toLowerCase() } : {}),
    };
    if (actionType === "add_tag" || actionType === "remove_tag") {
      const tag = typeof config.tag === "string" ? config.tag.trim().slice(0, 100) : "";
      if (!tag) return { ok: false, code: "invalid_action_config" };
      const tags = Array.isArray(lead.tags) ? lead.tags.filter((item: unknown) => typeof item === "string") : [];
      patch.tags = actionType === "add_tag" ? [...new Set([...tags, tag])] : tags.filter((item: string) => item !== tag);
    }
    const { error } = await db.from("marketing_subscribers").update(patch).eq("id", leadId).eq("client_id", accountId);
    return error ? { ok: false, code: "lead_write_failed" } : { ok: true, output: { lead_id: leadId } };
  }
  if (actionType === "save_contact_activity") return { ok: false, code: "unsupported_schema" };
  return { ok: false, code: "action_not_supported" };
}

async function runAutomation(db: any, automation: any, eventRow: any, chain: ChainContext, deliveries: JsonObject[], chained = false): Promise<{ status: string; executionId?: string }> {
  if (automation.account_id !== eventRow.account_id || automation.status !== "active" || !automation.published_version_id) return { status: "not_eligible" };
  const { data: version } = await db.from("automation_versions").select("*").eq("id", automation.published_version_id)
    .eq("automation_id", automation.id).eq("account_id", eventRow.account_id).maybeSingle();
  if (!version || (!chained && !matchesTrigger(version.trigger_type, eventRow.event_type))) return { status: "not_matched" };
  if (!evaluateConditions(version.definition?.conditions, eventRow.payload)) return { status: "conditions_not_met" };
  const { data: execution, error: executionError } = await db.from("automation_executions").insert({
    account_id: eventRow.account_id, automation_id: automation.id, version_id: version.id, event_id: eventRow.id,
    status: "running", correlation_id: chain.correlationId, workflow_depth: chain.depth,
    visited_automation_ids: chain.visitedAutomationIds, input: { event_type: eventRow.event_type }, started_at: new Date().toISOString(),
  }).select("id").single();
  if (executionError?.code === "23505") return { status: "duplicate" };
  if (executionError) throw executionError;
  const steps = Array.isArray(version.definition?.steps) ? version.definition.steps : [];
  let failed: { code: string; step: string } | null = null;
  for (let position = 0; position < steps.length; position++) {
    const step = steps[position];
    const startedAt = new Date().toISOString();
    let result: any;
    if (step.actionType === "continue_workflow") {
      const targetId = typeof step.config?.targetAutomationId === "string" ? step.config.targetAutomationId : "";
      const chainCheck = checkChainTarget(chain, targetId);
      if (!chainCheck.allowed) result = { ok: false, code: chainCheck.code };
      else {
        const { data: target } = await db.from("automations").select("*").eq("id", targetId).eq("account_id", eventRow.account_id).eq("status", "active").maybeSingle();
        if (!target) result = { ok: false, code: "chain_target_not_found" };
        else {
          const chainedResult = await runAutomation(db, target, eventRow, chainCheck.next!, deliveries, true);
          result = chainedResult.status === "succeeded" ? { ok: true, output: { execution_id: chainedResult.executionId } } : { ok: false, code: chainedResult.status };
        }
      }
    } else if (step.actionType === "wait") {
      const seconds = Number(step.config?.seconds ?? 0);
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 31_536_000) result = { ok: false, code: "invalid_wait_duration" };
      else {
        const dueAt = new Date(Date.now() + seconds * 1000).toISOString();
        const { data: waitingStep, error: waitingError } = await db.from("automation_step_executions").insert({
          account_id: eventRow.account_id, execution_id: execution.id, version_id: version.id,
          step_key: step.key || `step_${position}`, status: "waiting", input: {}, output: { due_at: dueAt },
          started_at: startedAt,
        }).select("id").single();
        if (waitingError) throw waitingError;
        const { error: jobError } = await db.from("automation_jobs").insert({
          account_id: eventRow.account_id, execution_id: execution.id, step_execution_id: waitingStep.id,
          job_type: "wait", due_at: dueAt, idempotency_key: `wait:${execution.id}:${step.key}`,
          payload: { next_position: position + 1, version_id: version.id, correlation_id: chain.correlationId },
        });
        if (jobError && jobError.code !== "23505") throw jobError;
        await db.from("automation_executions").update({ status: "waiting", current_step_key: step.key, step_count: position + 1 })
          .eq("id", execution.id).eq("account_id", eventRow.account_id);
        return { status: "waiting", executionId: execution.id };
      }
    } else result = await executeAction(db, step.actionType, step.config || {}, eventRow.payload, eventRow.account_id, deliveries, chain.correlationId, `${execution.id}:${step.key}:${1}`);
    await db.from("automation_step_executions").insert({
      account_id: eventRow.account_id, execution_id: execution.id, version_id: version.id,
      step_key: step.key || `step_${position}`, status: result.ok ? "succeeded" : "failed",
      input: {}, output: redactForLog(result.output || {}), error_code: result.ok ? null : result.code,
      started_at: startedAt, completed_at: new Date().toISOString(),
    });
    if (!result.ok) {
      failed = { code: result.code, step: step.key };
      for (const skipped of steps.slice(position + 1)) {
        await db.from("automation_step_executions").insert({
          account_id: eventRow.account_id, execution_id: execution.id, version_id: version.id,
          step_key: skipped.key, status: "skipped", input: {}, output: {}, error_code: "prior_step_failed",
          completed_at: new Date().toISOString(),
        });
      }
      break;
    }
  }
  const completedAt = new Date().toISOString();
  await db.from("automation_executions").update({
    status: failed ? "failed" : "succeeded", step_count: failed ? steps.findIndex((s: any) => s.key === failed!.step) + 1 : steps.length,
    error_code: failed?.code || null, error_message: failed ? `Action ${failed.step} failed` : null,
    output: failed ? { failed_step: failed.step } : { action_count: steps.length }, completed_at: completedAt,
  }).eq("id", execution.id).eq("account_id", eventRow.account_id);
  return { status: failed ? "failed" : "succeeded", executionId: execution.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 65536) return response({ error: "payload_too_large" }, 413);
    const candidate: unknown = await req.json();
    if (!validAutomationEventEnvelope(candidate, EVENT_TYPES)) {
      return response({ error: "invalid_event" }, 400);
    }
    const input = candidate as EventRequest;
    if (input.eventType === "ticket_purchase_completed") return response({ error: "verified_payment_required" }, 403);
    const requiredSource = EVENT_SOURCE[input.eventType];
    if (!requiredSource) return response({ error: "trusted_source_unavailable" }, 409);
    if (input.sourceType !== requiredSource) return response({ error: "trusted_record_required" }, 403);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const trusted = await resolveTrustedSource(db, input);
    const occurredAt = validAutomationEventTime(input.occurredAt);
    if (!occurredAt) return response({ error: "invalid_event_time" }, 400);
    const payload = {
      event_type: input.eventType, occurred_at: occurredAt, flyer_id: trusted.flyerId,
      actor: Object.keys(trusted.trustedActor).length ? trusted.trustedActor : {},
      metadata: { ...cleanMetadata(input.metadata), ...trusted.trustedMetadata, flyer_category: trusted.flyerCategory },
    };
    const idempotencyKey = automationEventIdempotencyKey(input.eventType, input.sourceType, trusted.sourceId, input.clientEventId);
    const { data: existing } = await db.from("automation_events").select("*").eq("account_id", trusted.accountId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return response({ eventId: existing.id, duplicate: true, deliveries: [] });
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db.from("automation_events").select("id", { count: "exact", head: true })
      .eq("account_id", trusted.accountId).eq("source_type", input.sourceType).eq("source_id", trusted.sourceId)
      .gte("received_at", oneMinuteAgo);
    if (isAutomationRateLimited(count)) return response({ error: "rate_limited" }, 429);
    const correlationId = crypto.randomUUID();
    const { data: eventRow, error } = await db.from("automation_events").insert({
      account_id: trusted.accountId, flyer_id: trusted.flyerId, event_type: input.eventType,
      source_type: input.sourceType, source_id: trusted.sourceId, correlation_id: correlationId,
      idempotency_key: idempotencyKey, payload, occurred_at: occurredAt,
    }).select("*").single();
    if (error?.code === "23505") return response({ duplicate: true, deliveries: [] });
    if (error) throw error;
    const { data: automations } = await db.from("automations").select("*").eq("account_id", trusted.accountId)
      .eq("status", "active").eq("trigger_type", input.eventType).not("published_version_id", "is", null)
      .or(`flyer_id.is.null,flyer_id.eq.${trusted.flyerId}`);
    const deliveries: JsonObject[] = [];
    const results = [];
    for (const automation of automations || []) {
      results.push(await runAutomation(db, automation, eventRow, {
        correlationId, depth: 0, visitedAutomationIds: [automation.id],
      }, deliveries));
    }
    return response({ eventId: eventRow.id, duplicate: false, results, deliveries });
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    const status = code === "unknown_source" || code === "source_not_public" ? 404 : 500;
    return response({ error: status === 500 ? "internal_error" : code }, status);
  }
});
