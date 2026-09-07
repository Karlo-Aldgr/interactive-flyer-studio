import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260830210000_automation_execution_engine.sql", "utf8");
const foundation = fs.readFileSync("supabase/migrations/20260830170000_automation_foundation.sql", "utf8");
const engine = fs.readFileSync("supabase/functions/automation-engine/index.ts", "utf8");

describe("Phase 2C tenant security", () => {
  it("separates read and mutation authorization", () => {
    expect(migration).toContain("automation_account_can_read");
    expect(migration).toContain("automation_account_can_mutate");
    const mutateBody = migration.split("automation_account_can_mutate")[1].split("$$;")[0];
    expect(mutateBody).not.toContain("'admin'::public.app_role");
    expect(migration).toContain("publish_automation");
    expect(migration).toContain("automation_account_can_mutate(_automation.account_id");
  });
  it("matches runtime records by exact trusted account", () => {
    expect(engine).toContain('.eq("account_id", trusted.accountId)');
    expect(engine).toContain("automation.account_id !== eventRow.account_id");
    expect(engine).toContain('.eq("account_id", eventRow.account_id)');
  });
  it("rejects ticket completion and strips supplied ownership", () => {
    expect(engine).toContain("verified_payment_required");
    expect(engine).not.toMatch(/input\.(accountId|account_id|tenantId|tenant_id|userId|user_id)/);
  });
  it("requires each public event to use its trusted source relationship", () => {
    expect(engine).toContain("const EVENT_SOURCE");
    expect(engine).toContain('ticket_purchase_completed: null');
    expect(engine).toContain("input.sourceType !== requiredSource");
    expect(engine).toContain("trusted_source_unavailable");
  });
  it("keeps operational writes server-side", () => {
    expect(engine).toContain('requiredEnv("SUPABASE_SERVICE_ROLE_KEY")');
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).*automation_(events|executions|step_executions|jobs).*anon/i);
  });
  it("uses immutable published versions and database idempotency", () => {
    expect(engine).toContain("automation.published_version_id");
    expect(engine).toContain('.eq("id", automation.published_version_id)');
    expect(engine).not.toContain("automation.draft_definition");
    expect(foundation).toContain("automation_executions_event_once_idx");
    expect(engine).toContain("idempotency_key");
    expect(engine).toContain('executionError?.code === "23505"');
  });
  it("records failures and skips remaining actions", () => {
    expect(engine).toContain('status: "skipped"');
    expect(engine).toContain('error_code: "prior_step_failed"');
    expect(engine).toContain('status: failed ? "failed" : "succeeded"');
  });
  it("uses the recovered marketing schema for lead mutation and contact activity", () => {
    expect(engine).toContain('.from("marketing_subscribers")');
    expect(engine).toContain('.from("marketing_subscriber_events")');
    expect(engine).toContain('.eq("client_id", accountId)');
    expect(engine).not.toContain('code: "unsupported_schema"');
  });
});
