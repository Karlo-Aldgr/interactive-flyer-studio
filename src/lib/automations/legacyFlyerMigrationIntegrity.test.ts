import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const helperMigration = "20260621120100_restore_legacy_user_can_manage_flyer.sql";
const helperSql = readFileSync(resolve(migrationsDirectory, helperMigration), "utf8");

describe("legacy flyer authorization migration integrity", () => {
  it("installs the production-compatible helper before every historical use", () => {
    const helperIndex = migrationFiles.indexOf(helperMigration);
    const referencingIndexes = migrationFiles.flatMap((file, index) => {
      if (file === helperMigration) return [];
      const sql = readFileSync(resolve(migrationsDirectory, file), "utf8");
      return sql.includes("public.user_can_manage_flyer(") ? [index] : [];
    });

    expect(helperIndex).toBeGreaterThan(-1);
    expect(referencingIndexes.length).toBeGreaterThan(0);
    expect(helperIndex).toBeLessThan(Math.min(...referencingIndexes));
  });

  it("retains the authoritative legacy owner, admin, and editor checks", () => {
    expect(helperSql).toContain("f.owner_id = auth.uid()");
    expect(helperSql).toContain("public.has_role(auth.uid(), 'admin'::app_role)");
    expect(helperSql).toContain("public.current_user_can_edit()");
    expect(helperSql).toContain("SECURITY DEFINER");
    expect(helperSql).toContain("SET search_path TO 'public'");
  });
});
