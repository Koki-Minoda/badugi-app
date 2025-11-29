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

  it("doubles the bet size once drawRound progresses", () => {
    expect(
      getFixedLimitBetSize({
        baseBet: 20,
        drawRound: 1,
      })
    ).toBe(40);
    expect(isBigBetStreet({ drawRound: 1, betRound: 0 })).toBe(true);
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
});

