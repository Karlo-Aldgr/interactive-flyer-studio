import { describe, expect, it } from "vitest";
import { automationVersionMatchesDraft } from "./service";
import type { Automation, AutomationVersion } from "./types";

const definition = {
  conditions: { match: "all" as const, items: [] },
  steps: [{ key: "popup", type: "action" as const, actionType: "show_popup" as const, config: { title: "Phase 4", message: "Safe result" } }],
};

describe("Phase 4 publish lifecycle", () => {
  it("does not create a new immutable version when resuming an unchanged paused automation", () => {
    const automation = { trigger_type: "flyer_viewed", trigger_config: { source: "viewer" }, draft_definition: definition } as Automation;
    const version = { trigger_type: "flyer_viewed", trigger_config: { source: "viewer" }, definition } as AutomationVersion;
    expect(automationVersionMatchesDraft(automation, version)).toBe(true);
  });

  it("requires republishing after the draft changes", () => {
    const automation = { trigger_type: "flyer_viewed", trigger_config: {}, draft_definition: definition } as Automation;
    const version = { trigger_type: "flyer_viewed", trigger_config: {}, definition: { ...definition, steps: [{ ...definition.steps[0], config: { title: "Old", message: "Old" } }] } } as AutomationVersion;
    expect(automationVersionMatchesDraft(automation, version)).toBe(false);
  });

  it("compares JSON objects independent of key insertion order", () => {
    const automation = { trigger_type: "flyer_viewed", trigger_config: { b: 2, a: 1 }, draft_definition: definition } as Automation;
    const version = { trigger_type: "flyer_viewed", trigger_config: { a: 1, b: 2 }, definition } as AutomationVersion;
    expect(automationVersionMatchesDraft(automation, version)).toBe(true);
  });
});
