import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260830170000_automation_foundation.sql"),
  "utf8",
).toLowerCase();

const privateTables = [
  "automations",
  "automation_versions",
  "automation_steps",
  "automation_events",
  "automation_executions",
  "automation_step_executions",
  "automation_jobs",
];

describe("automation migration tenant security", () => {
  it.each(privateTables)("enables RLS on %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(privateTables)("does not grant %s to anon", (table) => {
    expect(migration).not.toMatch(new RegExp(`grant\\s+[^;]+\\s+on\\s+public\\.${table}\\s+to\\s+anon`));
  });

  it("derives flyer tenancy from flyers.owner_id", () => {
    expect(migration).toMatch(/select owner_id into _resolved_account from public\.flyers/);
    expect(migration).toMatch(/select owner_id into _account from public\.flyers/);
  });

  it("keeps operational writes service-only", () => {
    for (const table of privateTables.slice(3)) {
      expect(migration).toContain(`grant select on public.${table} to authenticated`);
      expect(migration).not.toContain(`grant insert on public.${table} to authenticated`);
      expect(migration).not.toContain(`grant update on public.${table} to authenticated`);
      expect(migration).not.toContain(`grant delete on public.${table} to authenticated`);
    }
  });

  it("enforces event, execution, step, and job idempotency", () => {
    expect(migration).toContain("unique (account_id, idempotency_key)");
    expect(migration).toContain("automation_executions_event_once_idx");
    expect(migration).toContain("unique (execution_id, step_key, attempt)");
  });
});
