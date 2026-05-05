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
    expect(normalizeAppVariantId("S03")).toBe(APP_VARIANT_IDS.S03);
    expect(normalizeAppVariantId("D04")).toBe(APP_VARIANT_IDS.D04);
    expect(normalizeAppVariantId("badacey-triple-draw")).toBe(APP_VARIANT_IDS.D05);
    expect(normalizeAppVariantId("hidugi_td")).toBe(APP_VARIANT_IDS.D06);
    expect(normalizeAppVariantId("archie_triple_draw")).toBe(APP_VARIANT_IDS.D07);
    expect(normalizeAppVariantId("S04")).toBe(APP_VARIANT_IDS.S04);
    expect(normalizeAppVariantId("badeucey-single-draw")).toBe(APP_VARIANT_IDS.S05);
    expect(normalizeAppVariantId("badacey_sd")).toBe(APP_VARIANT_IDS.S06);
    expect(normalizeAppVariantId("hidugi_single_draw")).toBe(APP_VARIANT_IDS.S07);
    expect(normalizeAppVariantId("B02")).toBe(APP_VARIANT_IDS.FLH);
    expect(normalizeAppVariantId("B03")).toBe(APP_VARIANT_IDS.SUPER_HOLDEM);
    expect(normalizeAppVariantId("B04")).toBe(APP_VARIANT_IDS.FL_SUPER_HOLDEM);
    expect(normalizeAppVariantId("plo")).toBe(APP_VARIANT_IDS.PLO);
    expect(normalizeAppVariantId("PLO8")).toBe(APP_VARIANT_IDS.PLO8);
    expect(normalizeAppVariantId("FLO8")).toBe(APP_VARIANT_IDS.FLO8);
    expect(normalizeAppVariantId("pot_limit_omaha")).toBe(APP_VARIANT_IDS.PLO);
    expect(normalizeAppVariantId("big-o")).toBe(APP_VARIANT_IDS.BIG_O);
    expect(normalizeAppVariantId("5-card-plo")).toBe(APP_VARIANT_IDS.FIVE_CARD_PLO);
    expect(normalizeAppVariantId("dramaha")).toBe(APP_VARIANT_IDS.DRAMAHA_HI);
    expect(normalizeAppVariantId("dramaha-27")).toBe(APP_VARIANT_IDS.DRAMAHA_27);
    expect(normalizeAppVariantId("dramaha-a5")).toBe(APP_VARIANT_IDS.DRAMAHA_A5);
    expect(normalizeAppVariantId("dramaha-zero")).toBe(APP_VARIANT_IDS.DRAMAHA_ZERO);
    expect(normalizeAppVariantId("dramaha-hidugi")).toBe(APP_VARIANT_IDS.DRAMAHA_HIDUGI);
    expect(normalizeAppVariantId("dramaha-badugi")).toBe(APP_VARIANT_IDS.DRAMAHA_BADUGI);
    expect(normalizeAppVariantId("ST1")).toBe(APP_VARIANT_IDS.STUD);
    expect(normalizeAppVariantId("ST2")).toBe(APP_VARIANT_IDS.STUD8);
    expect(normalizeAppVariantId("ST3")).toBe(APP_VARIANT_IDS.RAZZ);
    expect(normalizeAppVariantId("ST4")).toBe(APP_VARIANT_IDS.RAZZDUGI);
    expect(normalizeAppVariantId("ST5")).toBe(APP_VARIANT_IDS.RAZZDUCEY);
    expect(normalizeAppVariantId("ST6")).toBe(APP_VARIANT_IDS.RAZZ27);
    expect(normalizeAppVariantId("CP1")).toBe(APP_VARIANT_IDS.CHINESE_POKER);
    expect(normalizeAppVariantId("ofc")).toBe(APP_VARIANT_IDS.CHINESE_POKER);
    expect(normalizeAppVariantId("unknown")).toBe(APP_VARIANT_IDS.BADUGI);
  });

  it("detects draw lowball and controller-backed variants", () => {
    expect(isDrawLowballAppVariant("D01")).toBe(true);
    expect(isDrawLowballAppVariant("ace_to_five_triple_draw")).toBe(true);
    expect(isDrawLowballAppVariant("badugi")).toBe(false);
    expect(isControllerBackedAppVariant("badugi")).toBe(true);
    expect(isControllerBackedAppVariant("D02")).toBe(true);
    expect(isControllerBackedAppVariant("S03")).toBe(true);
    expect(isControllerBackedAppVariant("D04")).toBe(true);
    expect(isControllerBackedAppVariant("D07")).toBe(true);
    expect(isControllerBackedAppVariant("S07")).toBe(true);
    expect(isControllerBackedAppVariant("nlh")).toBe(true);
    expect(isControllerBackedAppVariant("flh")).toBe(true);
    expect(isControllerBackedAppVariant("super_holdem")).toBe(true);
    expect(isControllerBackedAppVariant("fl_super_holdem")).toBe(true);
    expect(isControllerBackedAppVariant("plo")).toBe(true);
    expect(isControllerBackedAppVariant("plo8")).toBe(true);
    expect(isControllerBackedAppVariant("flo8")).toBe(true);
    expect(isControllerBackedAppVariant("big_o")).toBe(true);
    expect(isControllerBackedAppVariant("five_card_plo")).toBe(true);
    expect(isControllerBackedAppVariant("dramaha")).toBe(true);
    expect(isControllerBackedAppVariant("dramaha_27")).toBe(true);
    expect(isControllerBackedAppVariant("stud")).toBe(true);
    expect(isControllerBackedAppVariant("razz")).toBe(true);
    expect(isControllerBackedAppVariant("razz27")).toBe(true);
    expect(isControllerBackedAppVariant("razzdugi")).toBe(true);
    expect(isControllerBackedAppVariant("razzducey")).toBe(true);
    expect(isControllerBackedAppVariant("chinese_poker")).toBe(true);
  });
});
