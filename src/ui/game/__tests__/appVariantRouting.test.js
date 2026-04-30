import { describe, expect, it } from "vitest";
import {
  APP_VARIANT_IDS,
  isControllerBackedAppVariant,
  isDrawLowballAppVariant,
  normalizeAppVariantId,
} from "../appVariantRouting.js";

describe("appVariantRouting", () => {
  it("normalizes App variant aliases to canonical ids", () => {
    expect(normalizeAppVariantId("badugi")).toBe(APP_VARIANT_IDS.BADUGI);
    expect(normalizeAppVariantId("D01")).toBe(APP_VARIANT_IDS.D01);
    expect(normalizeAppVariantId("27td")).toBe(APP_VARIANT_IDS.D01);
    expect(normalizeAppVariantId("D02")).toBe(APP_VARIANT_IDS.D02);
    expect(normalizeAppVariantId("a5td")).toBe(APP_VARIANT_IDS.D02);
    expect(normalizeAppVariantId("S01")).toBe(APP_VARIANT_IDS.S01);
    expect(normalizeAppVariantId("S02")).toBe(APP_VARIANT_IDS.S02);
    expect(normalizeAppVariantId("unknown")).toBe(APP_VARIANT_IDS.BADUGI);
  });

  it("detects draw lowball and controller-backed variants", () => {
    expect(isDrawLowballAppVariant("D01")).toBe(true);
    expect(isDrawLowballAppVariant("ace_to_five_triple_draw")).toBe(true);
    expect(isDrawLowballAppVariant("badugi")).toBe(false);
    expect(isControllerBackedAppVariant("badugi")).toBe(true);
    expect(isControllerBackedAppVariant("D02")).toBe(true);
    expect(isControllerBackedAppVariant("nlh")).toBe(false);
  });
});
