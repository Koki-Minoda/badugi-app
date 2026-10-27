import { describe, expect, it } from "vitest";
import { canLaunchVariant, resolveVariantGateFlags } from "../canLaunchVariant.js";
import { listVariantAvailability, VARIANT_AVAILABILITY_STATES } from "../variantAvailability.js";

const previewVariant = listVariantAvailability()
  .find(({ availability }) => availability === VARIANT_AVAILABILITY_STATES.PREVIEW_ONLY)?.key;

describe("canLaunchVariant", () => {
  it("launches only alpha variants by default", () => {
    expect(canLaunchVariant("D01").canLaunch).toBe(true);
    expect(canLaunchVariant("D02").canLaunch).toBe(true);
    expect(canLaunchVariant("D06").canLaunch).toBe(true);
    expect(canLaunchVariant("D04").canLaunch).toBe(true);
    expect(canLaunchVariant("D05").canLaunch).toBe(true);
    expect(canLaunchVariant("D07").canLaunch).toBe(true);
    expect(canLaunchVariant("S01").canLaunch).toBe(true);
    expect(canLaunchVariant("S03").canLaunch).toBe(true);
    expect(canLaunchVariant("five_card_single_draw").canLaunch).toBe(true);
    expect(canLaunchVariant("S04").canLaunch).toBe(true);
    expect(canLaunchVariant("S05").canLaunch).toBe(true);
    expect(canLaunchVariant("S06").canLaunch).toBe(true);
    expect(canLaunchVariant("S07").canLaunch).toBe(true);
    expect(canLaunchVariant("badugi").canLaunch).toBe(true);
    expect(canLaunchVariant("flh").canLaunch).toBe(true);
    expect(canLaunchVariant("super_holdem").canLaunch).toBe(true);
    expect(canLaunchVariant("fl_super_holdem").canLaunch).toBe(true);
    expect(canLaunchVariant("chinese_poker").canLaunch).toBe(true);
    expect(canLaunchVariant("ofc").canLaunch).toBe(true);
  });

  it("allows preview variants only with the explicit preview flag", () => {
    if (previewVariant) {
      expect(canLaunchVariant(previewVariant).canLaunch).toBe(false);
      expect(canLaunchVariant(previewVariant, { previewVariants: true }).canLaunch).toBe(true);
    } else {
      expect(canLaunchVariant("not_registered", { previewVariants: true }).canLaunch).toBe(false);
    }
    expect(canLaunchVariant("chinese_poker", { previewVariants: true }).canLaunch).toBe(true);
    expect(canLaunchVariant("ofc", { previewVariants: true }).canLaunch).toBe(true);
  });

  it("reads safe local preview flags without requiring storage", () => {
    const storage = {
      getItem: (key) => (key === "mgx.previewVariants" ? "true" : null),
    };
    expect(resolveVariantGateFlags({ storage }).previewVariants).toBe(true);
    if (previewVariant) {
      expect(canLaunchVariant(previewVariant, { storage }).canLaunch).toBe(true);
      expect(canLaunchVariant(previewVariant, { storage: null }).canLaunch).toBe(false);
    } else {
      expect(canLaunchVariant("not_registered", { storage }).canLaunch).toBe(false);
    }
  });
});
