import { describe, it, expect } from "vitest";
import {
  isBetRoundComplete,
  closingSeatForAggressor,
  buildSidePots,
  resetBetRoundFlags,
} from "../../engine/roundFlow.js";

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

describe("buildSidePots", () => {
  const basePlayer = (overrides = {}) => ({
    name: overrides.name ?? "Seat",
    totalInvested: overrides.totalInvested ?? 0,
    betThisRound: overrides.betThisRound ?? 0,
    folded: overrides.folded ?? false,
    hasFolded: overrides.hasFolded ?? false,
    seatOut: overrides.seatOut ?? false,
  });

  it("returns single main pot when everyone has equal committed chips", () => {
    const players = [
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 120 }),
    ];
    expect(buildSidePots(players)).toEqual([{ amount: 360, eligible: [0, 1, 2] }]);
  });

  it("creates side pot only when higher stacks invest beyond an all-in threshold", () => {
    const players = [
      basePlayer({ totalInvested: 100 }),
      basePlayer({ totalInvested: 300 }),
      basePlayer({ totalInvested: 300 }),
    ];
    expect(buildSidePots(players)).toEqual([
      { amount: 300, eligible: [0, 1, 2] },
      { amount: 400, eligible: [1, 2] },
    ]);
  });

  it("keeps folded chips in the pot but excludes them from eligibility", () => {
    const players = [
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 80, folded: true, hasFolded: true }),
    ];
    expect(buildSidePots(players)).toEqual([{ amount: 320, eligible: [0, 1] }]);
  });

  it("produces a single pot when everyone folds except one player", () => {
    const players = [
      basePlayer({ totalInvested: 150 }),
      basePlayer({ totalInvested: 60, folded: true, hasFolded: true }),
      basePlayer({ totalInvested: 40, folded: true, hasFolded: true }),
    ];
    expect(buildSidePots(players)).toEqual([{ amount: 250, eligible: [0] }]);
  });
});

describe("resetBetRoundFlags", () => {
  it("resets hasActedThisRound for eligible players only", () => {
    const players = [
      {
        name: "Hero",
        folded: false,
        allIn: false,
        hasActedThisRound: true,
      },
      {
        name: "Folded",
        folded: true,
        hasFolded: true,
        hasActedThisRound: true,
      },
      {
        name: "AllIn",
        allIn: true,
        hasActedThisRound: true,
      },
    ];
    const reset = resetBetRoundFlags(players);
    expect(reset[0].hasActedThisRound).toBe(false);
    expect(reset[1]).toBe(players[1]);
    expect(reset[2]).toBe(players[2]);
  });

  it("returns original array when no changes are required", () => {
    const players = [
      makePlayer({ hasActedThisRound: false }),
      makePlayer({ folded: true, hasActedThisRound: true }),
    ];
    const result = resetBetRoundFlags(players);
    expect(result).toBe(players);
  });
});
