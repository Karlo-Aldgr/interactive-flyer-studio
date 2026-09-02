import { describe, expect, it } from "vitest";
import {
  automationEventIdempotencyKey,
  checkChainTarget, evaluateConditions, matchesTrigger, MAX_AUTOMATION_CHAIN_DEPTH,
  isAutomationRateLimited, redactForLog, runOrderedSteps, safeDeliveryUrl, selectEligibleAutomations,
  validAutomationEventEnvelope, validAutomationEventTime,
} from "../../../supabase/functions/_shared/automation-runtime";

const event = {
  event_type: "hotspot_clicked", flyer_id: "flyer-a", occurred_at: "2026-08-30T15:30:00Z",
  actor: { email: "person@example.com", phone: "5551234", city: "Columbus" },
  metadata: { flyer_category: "Event", state: "OH", hotspot_id: "buy", ticket_type: "VIP" },
};

describe("automation runtime", () => {
  it("deduplicates immutable trusted record events regardless of browser event ids", () => {
    expect(automationEventIdempotencyKey("form_submitted", "form_submission", "form-1", "browser-a"))
      .toBe(automationEventIdempotencyKey("form_submitted", "form_submission", "form-1", "browser-b"));
    expect(automationEventIdempotencyKey("flyer_tapped", "flyer", "flyer-1", "tap-a"))
      .not.toBe(automationEventIdempotencyKey("flyer_tapped", "flyer", "flyer-1", "tap-b"));
  });
  it("rejects malformed envelopes and replay timestamps", () => {
    const allowed = new Set(["flyer_viewed"]);
    expect(validAutomationEventEnvelope(null, allowed)).toBe(false);
    expect(validAutomationEventEnvelope({ eventType: "flyer_viewed", sourceId: "x", clientEventId: "y" }, allowed)).toBe(true);
    expect(validAutomationEventEnvelope({ eventType: "unknown", sourceId: "x", clientEventId: "y" }, allowed)).toBe(false);
    const now = Date.parse("2026-09-02T12:00:00Z");
    expect(validAutomationEventTime("2026-08-01T12:00:00Z", now)).toBeNull();
    expect(validAutomationEventTime("2026-09-02T12:06:00Z", now)).toBeNull();
  });
  it("enforces the application event rate limit boundary", () => {
    expect(isAutomationRateLimited(119)).toBe(false);
    expect(isAutomationRateLimited(120)).toBe(true);
  });
  it("matches triggers exactly", () => {
    expect(matchesTrigger("hotspot_clicked", event.event_type)).toBe(true);
    expect(matchesTrigger("flyer_viewed", event.event_type)).toBe(false);
  });
  it("evaluates AND and OR conditions", () => {
    expect(evaluateConditions({ match: "all", items: [
      { field: "flyer_id", operator: "equals", value: "flyer-a" }, { field: "city", operator: "equals", value: "columbus" },
      { field: "lead_email", operator: "exists" },
    ] }, event)).toBe(true);
    expect(evaluateConditions({ match: "any", items: [
      { field: "state", operator: "equals", value: "MI" }, { field: "ticket_type", operator: "equals", value: "vip" },
    ] }, event)).toBe(true);
  });
  it("fails closed for missing and invalid condition data", () => {
    expect(evaluateConditions({ match: "all", items: [{ field: "state", operator: "equals", value: "OH" }] }, {})).toBe(false);
    expect(evaluateConditions({ match: "all", items: [{ field: "date", operator: "before", value: "not-a-date" }] }, event)).toBe(false);
    expect(evaluateConditions({ match: "invalid" as "all", items: [{ field: "city", operator: "equals", value: "Columbus" }] }, event)).toBe(false);
  });
  it("supports deterministic date and time comparisons", () => expect(evaluateConditions({ match: "all", items: [
    { field: "date", operator: "equals", value: "2026-08-30" }, { field: "time", operator: "after", value: "15:00" },
  ] }, event)).toBe(true));
  it("prevents loops and excessive chain depth", () => {
    const base = { correlationId: "c", depth: 1, visitedAutomationIds: ["a"] };
    expect(checkChainTarget(base, "a").code).toBe("loop_prevented");
    expect(checkChainTarget({ ...base, depth: MAX_AUTOMATION_CHAIN_DEPTH }, "b").code).toBe("max_chain_depth");
    expect(checkChainTarget(base, "b").next?.visitedAutomationIds).toEqual(["a", "b"]);
  });
  it("redacts secrets and restricts client URLs", () => {
    expect(redactForLog({ authorization: "Bearer x", nested: { apiKey: "x" } })).toEqual({ authorization: "[REDACTED]", nested: { apiKey: "[REDACTED]" } });
    expect(safeDeliveryUrl("javascript:alert(1)")).toBeNull();
    expect(safeDeliveryUrl("/offers/1")).toBe("/offers/1");
  });
  it("runs only active published automations for the exact account", () => {
    const rows = [
      { id: "active", account_id: "a", status: "active", published_version_id: "v1", trigger_type: "flyer_viewed" },
      { id: "draft", account_id: "a", status: "draft", published_version_id: null, trigger_type: "flyer_viewed" },
      { id: "paused", account_id: "a", status: "paused", published_version_id: "v2", trigger_type: "flyer_viewed" },
      { id: "attack", account_id: "b", status: "active", published_version_id: "v3", trigger_type: "flyer_viewed" },
    ];
    expect(selectEligibleAutomations(rows, "a", "flyer_viewed").map((row) => row.id)).toEqual(["active"]);
  });
  it("preserves action ordering and stops after failure", async () => {
    const calls: string[] = [];
    const results = await runOrderedSteps([{ key: "one" }, { key: "two" }, { key: "three" }], async (step) => {
      calls.push(step.key); return step.key === "two" ? { ok: false, code: "provider_not_configured" } : { ok: true };
    });
    expect(calls).toEqual(["one", "two"]);
    expect(results.map((result) => result.status)).toEqual(["succeeded", "failed", "skipped"]);
  });
});
