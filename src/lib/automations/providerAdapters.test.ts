import { describe, expect, it, vi } from "vitest";
import { createAutomationProviderRegistry } from "../../../supabase/functions/_shared/automation-providers";

describe("automation provider adapters", () => {
  it("never fabricates provider success", async () => {
    await expect(createAutomationProviderRegistry().send_email({}, {}, { accountId: "a", correlationId: "c", idempotencyKey: "i" }))
      .resolves.toEqual({ ok: false, code: "provider_not_configured", retryable: false });
  });
  it("passes tenant and idempotency context to an explicitly configured adapter", async () => {
    const adapter = vi.fn(async () => ({ ok: true }));
    const registry = createAutomationProviderRegistry({ send_sms: adapter });
    await registry.send_sms({}, {}, { accountId: "tenant", correlationId: "correlation", idempotencyKey: "once" });
    expect(adapter).toHaveBeenCalledWith({}, {}, { accountId: "tenant", correlationId: "correlation", idempotencyKey: "once" });
  });
});
