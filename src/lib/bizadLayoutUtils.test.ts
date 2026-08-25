import { describe, expect, it } from "vitest";
import { BIZAD_LAYOUT_SOURCE, shouldOfferBizadLayoutReset } from "@/lib/bizadLayoutUtils";

describe("shouldOfferBizadLayoutReset", () => {
  it("offers reset when layout is missing", () => {
    expect(shouldOfferBizadLayoutReset(null)).toBe(true);
  });

  it("skips vontastic_v1 layouts", () => {
    expect(shouldOfferBizadLayoutReset({ source: BIZAD_LAYOUT_SOURCE, layers: [{ id: "1" }] })).toBe(false);
  });

  it("skips hand-edited rich layouts", () => {
    const layers = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
    expect(shouldOfferBizadLayoutReset({ layers })).toBe(false);
  });

  it("offers reset for stale minimal layouts", () => {
    expect(shouldOfferBizadLayoutReset({ layers: [{ id: "1" }, { id: "2" }] })).toBe(true);
  });
});
