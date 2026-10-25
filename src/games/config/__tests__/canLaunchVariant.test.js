import { describe, expect, it } from "vitest";
import { canLaunchVariant, resolveVariantGateFlags } from "../canLaunchVariant.js";

describe("canLaunchVariant", () => {
  it("launches only alpha variants by default", () => {
    expect(canLaunchVariant("D01").canLaunch).toBe(true);
    expect(canLaunchVariant("D02").canLaunch).toBe(true);
    expect(canLaunchVariant("D04").canLaunch).toBe(true);
    expect(canLaunchVariant("S01").canLaunch).toBe(true);
    expect(canLaunchVariant("badugi").canLaunch).toBe(true);
    expect(canLaunchVariant("flh").canLaunch).toBe(true);
    expect(canLaunchVariant("chinese_poker").canLaunch).toBe(true);
    expect(canLaunchVariant("ofc").canLaunch).toBe(true);
  });

  it("allows preview variants only with the explicit preview flag", () => {
    expect(canLaunchVariant("fl_super_holdem").canLaunch).toBe(false);
    expect(canLaunchVariant("fl_super_holdem", { previewVariants: true }).canLaunch).toBe(true);
    expect(canLaunchVariant("chinese_poker", { previewVariants: true }).canLaunch).toBe(true);
    expect(canLaunchVariant("ofc", { previewVariants: true }).canLaunch).toBe(true);
  });

  it("reads safe local preview flags without requiring storage", () => {
    const storage = {
      getItem: (key) => (key === "mgx.previewVariants" ? "true" : null),
    };
    expect(resolveVariantGateFlags({ storage }).previewVariants).toBe(true);
    expect(canLaunchVariant("fl_super_holdem", { storage }).canLaunch).toBe(true);
    expect(canLaunchVariant("fl_super_holdem", { storage: null }).canLaunch).toBe(false);
  });
});
