import { describe, expect, it } from "vitest";
import { validateAutomationDefinition } from "./validation";

describe("automation definition validation", () => {
  it("accepts an ordered multi-action definition", () => {
    const value = validateAutomationDefinition({
      conditions: { match: "all", items: [] },
      steps: [
        { key: "popup", type: "action", actionType: "show_popup", config: { title: "Thanks", message: "We received your request." }, nextStepKey: "email" },
        { key: "email", type: "action", actionType: "send_email", config: { subject: "Thanks", body: "We received your request." } },
      ],
    });
    expect(value.steps).toHaveLength(2);
  });

  it("rejects duplicate step keys", () => {
    expect(() => validateAutomationDefinition({
      conditions: { match: "all", items: [] },
      steps: [
        { key: "same", type: "action", actionType: "show_popup", config: {} },
        { key: "same", type: "action", actionType: "open_url", config: {} },
      ],
    })).toThrow(/unique/i);
  });

  it("rejects cross-references to missing steps", () => {
    expect(() => validateAutomationDefinition({
      conditions: { match: "all", items: [] },
      steps: [{ key: "first", type: "action", actionType: "show_popup", config: {}, nextStepKey: "missing" }],
    })).toThrow(/unknown step/i);
  });

  it("validates provider-backed action configuration without sending anything", () => {
    expect(() => validateAutomationDefinition({
      conditions: { match: "all", items: [] },
      steps: [{ key: "email", type: "action", actionType: "send_email", config: { subject: "", body: "" } }],
    })).toThrow();
    expect(validateAutomationDefinition({
      conditions: { match: "all", items: [] },
      steps: [{ key: "email", type: "action", actionType: "send_email", config: { subject: "Thanks", body: "We received your request." } }],
    }).steps[0].actionType).toBe("send_email");
  });

  it("accepts the Phase 2B condition catalog", () => {
    const definition = validateAutomationDefinition({
      conditions: {
        match: "all",
        items: [
          { id: "city", field: "city", operator: "equals", value: "Columbus" },
          { id: "email", field: "lead_email", operator: "exists" },
          { id: "date", field: "date", operator: "after", value: "2026-08-30" },
        ],
      },
      steps: [{ key: "lead", type: "action", actionType: "create_lead", config: {} }],
    });
    expect(definition.conditions.items).toHaveLength(3);
  });
});
