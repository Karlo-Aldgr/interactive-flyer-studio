import { describe, expect, it } from "vitest";
import { safeAutomationError, sanitizeAutomationHistory } from "./history";

describe("automation history sanitization", () => {
  it("redacts nested secrets and payment data", () => {
    expect(sanitizeAutomationHistory({ ok: true, nested: { authorization: "Bearer secret", api_key: "key", card_number: "4111" } })).toEqual({
      ok: true, nested: { authorization: "[REDACTED]", api_key: "[REDACTED]", card_number: "[REDACTED]" },
    });
  });

  it("truncates oversized output", () => {
    expect((sanitizeAutomationHistory({ text: "x".repeat(1200) }) as { text: string }).text.length).toBe(1001);
  });

  it("only exposes safe error codes and removes URLs", () => {
    expect(safeAutomationError("provider_timeout", "POST https://provider.test/token failed")).toEqual({ code: "provider_timeout", message: "POST [URL REDACTED] failed" });
    expect(safeAutomationError("bad code!", "secret")).toEqual({ code: null, message: null });
  });
});
