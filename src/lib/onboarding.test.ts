import { describe, expect, it } from "vitest";
import { buildChatbotKnowledgeFromOnboarding } from "./onboarding";

describe("buildChatbotKnowledgeFromOnboarding", () => {
  it("builds readable facts from onboarding fields", () => {
    const text = buildChatbotKnowledgeFromOnboarding({
      business_name: "Express Tshirts & Graphics",
      business_slogan: "Print it right",
      business_description: "Custom shirts and signs in Columbus, MS.",
    ai_details: null,
      business_address: "513 13th Ave S, Columbus, MS",
      phone: "662-549-1457",
      email: "hello@example.com",
      website_url: "https://example.com",
      facebook_url: "https://facebook.com/example",
      instagram_url: null,
      tiktok_url: null,
      other_social_url: null,
      full_name: "Sherman",
    });

    expect(text).toContain("Business name: Express Tshirts & Graphics");
    expect(text).toContain("About the business:");
    expect(text).toContain("Custom shirts and signs in Columbus, MS.");
    expect(text).toContain("Website: https://example.com");
  });

  it("returns empty string when no fields are provided", () => {
    expect(buildChatbotKnowledgeFromOnboarding({} as never)).toBe("");
  });
});
