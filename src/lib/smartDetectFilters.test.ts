import { describe, expect, it } from "vitest";
import {
  filterSmartDetections,
  looksLikePhone,
  looksLikeUrl,
  looksLikeDateOrTime,
  isReasonableBbox,
} from "../../supabase/functions/_shared/smartDetectFilters.ts";

describe("smartDetectFilters", () => {
  it("accepts valid phone, url, and date text", () => {
    expect(looksLikePhone("(555) 867-5309")).toBe(true);
    expect(looksLikeUrl("www.vet4success.com")).toBe(true);
    expect(looksLikeDateOrTime("August 24, 2026")).toBe(true);
  });

  it("rejects logo-sized square bboxes", () => {
    expect(isReasonableBbox("phone", { x: 0.2, y: 0.2, width: 0.25, height: 0.22 })).toBe(false);
    expect(isReasonableBbox("phone", { x: 0.5, y: 0.8, width: 0.3, height: 0.04 })).toBe(true);
  });

  it("filters junk logo detections from AI output", () => {
    const filtered = filterSmartDetections([
      {
        kind: "phone",
        text: "(555) 867-5309",
        bbox: { x: 0.1, y: 0.85, width: 0.35, height: 0.04 },
      },
      {
        kind: "url",
        text: "KWIK",
        bbox: { x: 0.15, y: 0.2, width: 0.2, height: 0.18 },
      },
      {
        kind: "phone",
        text: "LOGO",
        bbox: { x: 0.2, y: 0.2, width: 0.15, height: 0.15 },
      },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe("(555) 867-5309");
  });
});
