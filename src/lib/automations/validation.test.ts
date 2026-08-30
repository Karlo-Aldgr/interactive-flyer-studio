import { describe, expect, it } from "vitest";
import { validateAutomationDefinition } from "./validation";

describe("automation definition validation", () => {
  it("accepts an ordered multi-action definition", () => {
    const value = validateAutomationDefinition({
      conditions: { match: "all", items: [] },
      steps: [
        { key: "popup", type: "action", actionType: "show_popup", config: { title: "Thanks" }, nextStepKey: "email" },
        { key: "email", type: "action", actionType: "send_email", config: { template: "lead_confirmation" } },
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
});
