import type { JsonObject } from "./automation-runtime.ts";

export type AutomationActionResult = { ok: boolean; code?: string; output?: JsonObject; retryable?: boolean };
export type AutomationProviderContext = { accountId: string; correlationId: string; idempotencyKey: string };
export type AutomationProviderAdapter = (config: JsonObject, event: JsonObject, context: AutomationProviderContext) => Promise<AutomationActionResult>;
export type AutomationProviderRegistry = Record<string, AutomationProviderAdapter>;

export const providerNotConfigured: AutomationProviderAdapter = async () => ({ ok: false, code: "provider_not_configured", retryable: false });

export function createAutomationProviderRegistry(adapters: Partial<AutomationProviderRegistry> = {}): AutomationProviderRegistry {
  return {
    send_email: adapters.send_email ?? providerNotConfigured,
    send_sms: adapters.send_sms ?? providerNotConfigured,
    send_notification: adapters.send_notification ?? providerNotConfigured,
    send_appointment_confirmation: adapters.send_appointment_confirmation ?? providerNotConfigured,
    send_ticket_confirmation: adapters.send_ticket_confirmation ?? providerNotConfigured,
  };
}
