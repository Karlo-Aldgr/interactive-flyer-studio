import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_REGISTRY, CONDITION_FIELD_REGISTRY, TRIGGER_REGISTRY } from "./registry";

const service = readFileSync(resolve(process.cwd(), "src/lib/automations/service.ts"), "utf8");
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260830190000_automation_builder_catalog.sql"),
  "utf8",
).toLowerCase();

describe("Phase 2B builder security and catalog", () => {
  it("does not send account identity in create payloads", () => {
    const createBody = service.slice(service.indexOf("export async function createAutomation"), service.indexOf("export async function updateAutomation"));
    expect(createBody).not.toMatch(/account_id\s*:/);
    expect(createBody).toContain("account_id is intentionally omitted");
  });

  it("strips protected identity fields from updates", () => {
    expect(service).toContain("delete patch.account_id");
    expect(service).toContain("delete patch.created_by");
    expect(service).toContain("delete patch.published_version_id");
  });

  it("contains every requested builder trigger", () => {
    const types = new Set(TRIGGER_REGISTRY.map((item) => item.type));
    for (const trigger of ["flyer_viewed", "flyer_tapped", "hotspot_clicked", "qr_scanned", "contact_form_submitted", "appointment_request_submitted", "ticket_purchase_completed", "bizad_viewed", "bizad_action_clicked", "website_form_submitted", "lead_created"]) {
      expect(types.has(trigger as never)).toBe(true);
    }
  });

  it("contains every requested builder action and condition", () => {
    const actions = new Set(ACTION_REGISTRY.map((item) => item.type));
    for (const action of ["send_email", "send_sms", "show_popup", "send_notification", "create_lead", "update_lead", "add_tag", "remove_tag", "save_contact_activity", "send_appointment_confirmation", "send_ticket_confirmation", "open_url", "continue_workflow"]) {
      expect(actions.has(action as never)).toBe(true);
    }
    expect(CONDITION_FIELD_REGISTRY.map((item) => item.field)).toEqual(expect.arrayContaining([
      "flyer_id", "flyer_category", "city", "state", "date", "time", "lead_email", "lead_phone", "ticket_type", "hotspot_id",
    ]));
  });

  it("only expands allowlists and grants no access", () => {
    expect(migration).not.toContain("grant ");
    expect(migration).not.toContain("create policy");
    expect(migration).not.toContain("disable row level security");
  });
});
