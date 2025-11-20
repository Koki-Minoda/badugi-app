import { describe, it, expect } from "vitest";
import { isBetRoundComplete, closingSeatForAggressor } from "../../engine/roundFlow.js";

const makePlayer = ({
  folded = false,
  allIn = false,
  betThisRound = 0,
  hasActedThisRound = false,
} = {}) => ({
  folded,
  allIn,
  betThisRound,
  hasActedThisRound,
});

describe("closingSeatForAggressor", () => {
  it("returns aggressor seat when still active", () => {
    const players = [makePlayer(), makePlayer()];
    expect(closingSeatForAggressor(players, 1)).toBe(1);
  });

  it("returns next eligible seat when aggressor is all-in", () => {
    const players = [
      makePlayer({ allIn: true }),
      makePlayer({ folded: false }),
      makePlayer({ folded: false }),
    ];
    expect(closingSeatForAggressor(players, 0)).toBe(1);
  });

  it("returns null when aggressor index is invalid or folded", () => {
    const players = [makePlayer({ folded: true })];
    expect(closingSeatForAggressor(players, null)).toBeNull();
    expect(closingSeatForAggressor(players, 0)).toBeNull();
  });
});

describe("isBetRoundComplete", () => {
  it("returns true when zero or one active player remains", () => {
    const players = [
      makePlayer({ folded: true }),
      makePlayer({ betThisRound: 0, hasActedThisRound: false }),
    ];
    expect(isBetRoundComplete(players)).toBe(true);
  });

  it("returns false when bet sizes mismatch", () => {
    const players = [
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ betThisRound: 10, hasActedThisRound: true }),
      makePlayer({ folded: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(false);
  });

  it("returns false when some active player has not acted yet", () => {
    const players = [
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ betThisRound: 20, hasActedThisRound: false }),
      makePlayer({ allIn: true, hasActedThisRound: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(false);
  });

  it("returns true when all active players matched bet or are all-in and have acted", () => {
    const players = [
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ allIn: true, hasActedThisRound: true }),
      makePlayer({ folded: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(true);
  });
});
