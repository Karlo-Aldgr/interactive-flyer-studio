import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = resolve(process.cwd(), "supabase/migrations");
const readMigration = (name: string) =>
  readFileSync(resolve(migrations, name), "utf8");

describe("customer portal fresh-chain migration compatibility", () => {
  it("brackets the historical invalid status and installs the canonical delivered predicate", () => {
    const prerequisite = readMigration(
      "20260825152359_defer_customer_portal_link_function_validation.sql",
    );
    const historical = readMigration(
      "20260825152400_customer_portal_link_rpc.sql",
    );
    const repair = readMigration(
      "20260825152401_repair_customer_portal_link_job_status.sql",
    );

    expect(prerequisite).toMatch(/SET\s+check_function_bodies\s*=\s*off/i);
    expect(historical).toContain("'completed'");
    expect(repair).toMatch(/j\.status\s+IN\s*\([\s\S]*'paid'::public\.job_status[\s\S]*'delivered'::public\.job_status[\s\S]*\)/i);
    expect(repair).not.toMatch(/'completed'::public\.job_status/i);
    expect(repair).toMatch(/SECURITY\s+DEFINER/i);
    expect(repair).toMatch(/SET\s+search_path\s*=\s*public/i);
    expect(repair).toMatch(/REVOKE\s+ALL[\s\S]*FROM\s+PUBLIC,\s*anon/i);
    expect(repair).toMatch(/GRANT\s+EXECUTE[\s\S]*TO\s+authenticated/i);
    expect(repair).toMatch(/SET\s+check_function_bodies\s*=\s*on/i);
  });
});
