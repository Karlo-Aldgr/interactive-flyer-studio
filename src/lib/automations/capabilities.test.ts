import { describe, expect, it } from "vitest";
import { automationCapability } from "./registry";

describe("automation capability labels", () => {
  it("does not present providers, payments, or scheduling as fully operational", () => {
    expect(automationCapability("send_email")).toBe("configuration_required");
    expect(automationCapability("wait")).toBe("configuration_required");
    expect(automationCapability("ticket_purchase_completed")).toBe("not_yet_available");
  });
  it("marks trusted connected sources as available", () => {
    expect(automationCapability("website_form_submitted")).toBe("available");
    expect(automationCapability("qr_scanned")).toBe("available");
    expect(automationCapability("save_contact_activity")).toBe("available");
    expect(automationCapability("flyer_shared")).toBe("not_yet_available");
    expect(automationCapability("open_email")).toBe("not_yet_available");
    expect(automationCapability("continue_workflow")).toBe("not_yet_available");
  });
});
