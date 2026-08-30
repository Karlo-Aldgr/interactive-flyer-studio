import { describe, expect, it, vi } from "vitest";
import { deliverAutomationResults } from "./ingestion";

describe("automation client delivery", () => {
  it("delivers messages without executing arbitrary code", () => {
    const show = vi.fn();
    deliverAutomationResults([{ type: "show_popup", title: "Hi", message: "Safe" }], show);
    expect(show).toHaveBeenCalledWith("Hi", "Safe");
  });
  it("ignores unsafe URLs", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    deliverAutomationResults([{ type: "open_url", url: "javascript:alert(1)" }], vi.fn());
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
