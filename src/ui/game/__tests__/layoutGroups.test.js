import { describe, expect, it } from "vitest";
import {
  LAYOUT_GROUPS,
  getVariantLayoutProfile,
  isDrawLowballFiveCardLayout,
} from "../layoutGroups.js";

describe("layoutGroups", () => {
  it("maps Badugi to the four-card Badugi layout group", () => {
    expect(getVariantLayoutProfile("badugi")).toMatchObject({
      layoutGroup: LAYOUT_GROUPS.BADUGI,
      handCardCount: 4,
    });
  });

  it.each([
    ["A-5TD", "D02"],
    ["2-7TD", "D01"],
    ["A-5SD", "S02"],
    ["2-7SD", "S01"],
  ])(
    "maps %s to the shared five-card draw lowball layout group",
    (_label, variantId) => {
      expect(getVariantLayoutProfile(variantId)).toMatchObject({
        layoutGroup: LAYOUT_GROUPS.DRAW_LOWBALL_5CARD,
        handCardCount: 5,
      });
      expect(isDrawLowballFiveCardLayout(variantId)).toBe(true);
    },
  );
});
