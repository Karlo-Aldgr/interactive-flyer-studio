import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const engine = read("../../../supabase/functions/automation-engine/index.ts");
const migration = read("../../../supabase/migrations/20260902090000_automation_phase_2d.sql");
const qr = read("../../../supabase/functions/qr-redirect/index.ts");

describe("Phase 2D security boundaries", () => {
  it("rejects browser payment completion claims", () => expect(engine).toContain('return response({ error: "verified_payment_required" }, 403)'));
  it("resolves forms, subscribers, QR, and chains through tenant-qualified records", () => {
    expect(engine).toContain('.from("form_submissions")');
    expect(engine).toContain('.from("subscribers")');
    expect(engine).toContain('.eq("account_id", eventRow.account_id)');
    expect(qr).toContain('.eq("status", "published")');
    expect(qr).not.toMatch(/searchParams\.get\(["'](?:account|owner|tenant)/);
  });
  it("has payload, duplicate, replay, rate, and durable claim controls", () => {
    expect(engine).toContain("payload_too_large");
    expect(engine).toContain("invalid_event_time");
    expect(engine).toContain("rate_limited");
    expect(engine).toContain("idempotency_key");
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("pg_column_size(payload)");
  });
  it("does not grant customers or admins operational mutation", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.claim_due_automation_jobs(text, integer) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.claim_due_automation_jobs(text, integer) TO service_role");
  });
});
