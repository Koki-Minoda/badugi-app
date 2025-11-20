import { describe, expect, it } from "vitest";
import { deriveForcedBetConfig } from "../forcedBets.js";

describe("deriveForcedBetConfig", () => {
  it("handles blinds structure", () => {
    const result = deriveForcedBetConfig({
      forcedBets: { type: "blinds", smallBlind: 50, bigBlind: 100, ante: 5 },
    });
    expect(result).toEqual({
      smallBlind: 50,
      bigBlind: 100,
      ante: 5,
      betSize: 100,
    });
  });

  it("handles limit structure", () => {
    const result = deriveForcedBetConfig({
      forcedBets: { type: "limit", smallBet: 4, bigBet: 8, ante: 0 },
    });
    expect(result).toEqual({
      smallBlind: 4,
      bigBlind: 8,
      ante: 0,
      betSize: 8,
    });
  });

  it("handles stud structure with bring-in", () => {
    const result = deriveForcedBetConfig({
      forcedBets: { type: "stud", bringIn: 2, ante: 1 },
    });
    expect(result).toEqual({
      smallBlind: 2,
      bigBlind: 2,
      ante: 1,
      betSize: 2,
    });
  });

  it("falls back to defaults when missing data", () => {
    const result = deriveForcedBetConfig(null);
    expect(result.smallBlind).toBeGreaterThan(0);
    expect(result.bigBlind).toBeGreaterThan(result.smallBlind);
  });
});
