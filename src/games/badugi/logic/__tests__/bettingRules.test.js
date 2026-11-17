import { describe, expect, it } from "vitest";
import { getFixedLimitBetSize, isBigBetStreet } from "../bettingRules.js";

describe("bettingRules", () => {
  it("treats pre-draw betting as the small bet street", () => {
    expect(
      getFixedLimitBetSize({
        baseBet: 20,
        drawRound: 0,
        betRound: 0,
      })
    ).toBe(20);
    expect(isBigBetStreet({ drawRound: 0, betRound: 0 })).toBe(false);
  });

  it("uses the small bet after the first draw and doubles after the second", () => {
    expect(
      getFixedLimitBetSize({
        baseBet: 20,
        drawRound: 1,
      })
    ).toBe(20);
    expect(isBigBetStreet({ drawRound: 1, betRound: 0 })).toBe(false);
    expect(getFixedLimitBetSize({ baseBet: 20, drawRound: 2 })).toBe(40);
    expect(isBigBetStreet({ drawRound: 2, betRound: 0 })).toBe(true);
  });

  it("treats later bet rounds as big-bet streets even if drawRound is stale", () => {
    expect(
      getFixedLimitBetSize({
        baseBet: 30,
        drawRound: 0,
        betRound: 2,
      })
    ).toBe(60);
    expect(isBigBetStreet({ drawRound: 0, betRound: 2 })).toBe(true);
  });

  it("retains the older first-postdraw limit for other variants that opt in", () => {
    expect(getFixedLimitBetSize({ baseBet: 20, drawRound: 1, firstBigBetRound: 1 })).toBe(40);
  });
});

