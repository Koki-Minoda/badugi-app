import { describe, expect, it } from "vitest";
import { canLaunchVariant, resolveVariantGateFlags } from "../canLaunchVariant.js";

describe("canLaunchVariant", () => {
  it("launches only alpha variants by default", () => {
    expect(canLaunchVariant("D01").canLaunch).toBe(true);
    expect(canLaunchVariant("D02").canLaunch).toBe(true);
    expect(canLaunchVariant("S01").canLaunch).toBe(true);
    expect(canLaunchVariant("badugi").canLaunch).toBe(false);
    expect(canLaunchVariant("chinese_poker").canLaunch).toBe(false);
  });

  it("allows preview variants only with the explicit preview flag", () => {
    expect(canLaunchVariant("badugi", { previewVariants: true }).canLaunch).toBe(true);
    expect(canLaunchVariant("plo", { previewVariants: true }).canLaunch).toBe(true);
    expect(canLaunchVariant("chinese_poker", { previewVariants: true }).canLaunch).toBe(false);
  });

  it("reads safe local preview flags without requiring storage", () => {
    const storage = {
      getItem: (key) => (key === "mgx.previewVariants" ? "true" : null),
    };
    expect(resolveVariantGateFlags({ storage }).previewVariants).toBe(true);
    expect(canLaunchVariant("badugi", { storage }).canLaunch).toBe(true);
    expect(canLaunchVariant("badugi", { storage: null }).canLaunch).toBe(false);
  });
});
