import { describe, expect, it } from "vitest";
import {
  buildContributionPots,
  resolveHiLoContributionPots,
} from "../sidePotResolver.js";

const player = (seatIndex, totalInvested, extra = {}) => ({
  seatIndex,
  name: `P${seatIndex}`,
  totalInvested,
  stack: 0,
  ...extra,
});

describe("shared side-pot settlement", () => {
  it("includes folded chips but excludes folded seats from every award", () => {
    const pots = buildContributionPots([
      player(0, 25),
      player(1, 50, { folded: true }),
      player(2, 100),
    ]);

    expect(pots).toEqual([
      expect.objectContaining({ amount: 75, eligibleSeatIndexes: [0, 2] }),
      expect.objectContaining({ amount: 50, eligibleSeatIndexes: [2] }),
      expect.objectContaining({ amount: 50, eligibleSeatIndexes: [2] }),
    ]);
  });

  it("awards the odd hi/lo chip to high and preserves the complete pot", () => {
    const players = [player(0, 33), player(1, 33), player(2, 33)];
    const highEvaluations = players.map((entry, index) => ({
      player: entry,
      evaluation: { rank: index },
    }));
    const lowEvaluations = [
      { player: players[1], evaluation: { rank: 0 } },
      { player: players[2], evaluation: { rank: 1 } },
    ];
    const { payouts, potDetails } = resolveHiLoContributionPots({
      players,
      highEvaluations,
      lowEvaluations,
      compareHighEvaluations: (left, right) => left.rank - right.rank,
      compareLowEvaluations: (left, right) => left.rank - right.rank,
      totalPot: 99,
    });

    expect(potDetails[0].highWinners).toEqual([
      expect.objectContaining({ seatIndex: 0, payout: 50 }),
    ]);
    expect(potDetails[0].lowWinners).toEqual([
      expect.objectContaining({ seatIndex: 1, payout: 49 }),
    ]);
    expect(payouts.reduce((sum, payout) => sum + payout.payout, 0)).toBe(99);
  });
});
