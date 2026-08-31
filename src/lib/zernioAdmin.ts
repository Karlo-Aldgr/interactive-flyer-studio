import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-only helpers for the Zernio integration settings. The API key itself
 * lives server-side; nothing here ever receives or stores the raw value.
 */

export type ZernioAdminStatus = {
  configured: boolean;
  source: "environment" | "secure_storage" | null;
  key_hint: string | null;
  updated_at: string | null;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
};

export type ZernioTestResult = ZernioAdminStatus & { ok: boolean; message: string };

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("zernio-admin", { body });
  if (error) throw new Error(error.message || "Zernio request failed.");
  if (data?.error) throw new Error(data.error as string);
  return data as T;
}

export function fetchZernioAdminStatus() {
  return call<ZernioAdminStatus>({ action: "status" });
}

export function saveZernioApiKey(apiKey: string) {
  return call<ZernioAdminStatus>({ action: "save", api_key: apiKey });
}

export function removeZernioApiKey() {
  return call<ZernioAdminStatus>({ action: "remove" });
}

export function testZernioConnection() {
  return call<ZernioTestResult>({ action: "test" });
}
