import { describe, expect, it } from "vitest";
import {
  BIZAD_LAYOUT_SOURCE,
  isHandEditedBizadLayout,
  shouldOfferBizadLayoutReset,
  shouldRebuildBizadLayoutOnSave,
} from "@/lib/bizadLayoutUtils";

describe("isHandEditedBizadLayout", () => {
  it("is false when layout is missing", () => {
    expect(isHandEditedBizadLayout(null)).toBe(false);
  });

  it("is true for rich hand-edited layouts", () => {
    const layers = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
    expect(isHandEditedBizadLayout({ layers })).toBe(true);
  });

  it("is false for standard vontastic layouts", () => {
    expect(isHandEditedBizadLayout({ source: BIZAD_LAYOUT_SOURCE, layers: [{ id: "1" }] })).toBe(false);
  });
});

describe("shouldOfferBizadLayoutReset", () => {
  it("offers reset when layout is missing", () => {
    expect(shouldOfferBizadLayoutReset(null)).toBe(true);
  });

  it("offers reset for vontastic_v1 layouts", () => {
    expect(shouldOfferBizadLayoutReset({ source: BIZAD_LAYOUT_SOURCE, layers: [{ id: "1" }] })).toBe(true);
  });

  it("skips hand-edited rich layouts", () => {
    const layers = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
    expect(shouldOfferBizadLayoutReset({ layers })).toBe(false);
  });

  it("offers reset for stale minimal layouts", () => {
    expect(shouldOfferBizadLayoutReset({ layers: [{ id: "1" }, { id: "2" }] })).toBe(true);
  });
});

describe("shouldRebuildBizadLayoutOnSave", () => {
  it("rebuilds vontastic layouts on save", () => {
    expect(shouldRebuildBizadLayoutOnSave({ source: BIZAD_LAYOUT_SOURCE, layers: [{ id: "1" }] })).toBe(true);
  });

  it("skips hand-edited rich layouts", () => {
    const layers = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
    expect(shouldRebuildBizadLayoutOnSave({ layers })).toBe(false);
  });
});
