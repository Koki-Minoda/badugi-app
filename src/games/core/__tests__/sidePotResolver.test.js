import { describe, expect, it } from "vitest";
import {
  applyPayoutsToPlayers,
  buildContributionPots,
  resolveEvaluationPot,
  splitAmountBySeatOrder,
  summarizePayouts,
} from "../sidePotResolver.js";

function compareLowestScore(a, b) {
  return a.score - b.score;
}

describe("sidePotResolver", () => {
  it("builds contribution pots from all-in investments while excluding folded winners", () => {
    const pots = buildContributionPots([
      { totalInvested: 50, folded: false },
      { totalInvested: 100, folded: false },
      { totalInvested: 200, folded: false },
      { totalInvested: 200, folded: true },
    ]);

    expect(pots).toEqual([
      {
        potIndex: 0,
        amount: 200,
        potAmount: 200,
        contributorSeatIndexes: [0, 1, 2, 3],
        eligibleSeatIndexes: [0, 1, 2],
      },
      {
        potIndex: 1,
        amount: 150,
        potAmount: 150,
        contributorSeatIndexes: [1, 2, 3],
        eligibleSeatIndexes: [1, 2],
      },
      {
        potIndex: 2,
        amount: 200,
        potAmount: 200,
        contributorSeatIndexes: [2, 3],
        eligibleSeatIndexes: [2],
      },
    ]);
  });

  it("splits odd chips by stable seat order", () => {
    expect(splitAmountBySeatOrder(101, [{ seatIndex: 2 }, { seatIndex: 0 }])).toEqual([
      { seatIndex: 0, payout: 51 },
      { seatIndex: 2, payout: 50 },
    ]);
  });

  it("resolves a pot only among eligible contenders", () => {
    const players = [
      { seatIndex: 0, name: "Main" },
      { seatIndex: 1, name: "Side" },
      { seatIndex: 2, name: "Deep" },
    ];
    const evaluations = players.map((player, idx) => ({
      player,
      evaluation: { score: [1, 2, 0][idx] },
    }));

    const payouts = resolveEvaluationPot({
      amount: 100,
      eligibleSeatIndexes: [1, 2],
      evaluations,
      compareEvaluations: compareLowestScore,
    });

    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toMatchObject({
      player: players[2],
      payout: 100,
      evaluation: { score: 0 },
    });
  });

  it("applies and summarizes payouts by seat", () => {
    const players = [
      { seatIndex: 0, name: "Hero", stack: 0 },
      { seatIndex: 1, name: "CPU", stack: 0 },
    ];
    const payouts = [
      { player: players[0], payout: 75, evaluation: { score: 1 } },
      { player: players[0], payout: 25, evaluation: { score: 2 } },
      { player: players[1], payout: 50, evaluation: { score: 3 } },
    ];

    applyPayoutsToPlayers(players, payouts);

    expect(players.map((player) => player.stack)).toEqual([100, 50]);
    expect(summarizePayouts(payouts)).toEqual([
      { seatIndex: 0, name: "Hero", payout: 100, evaluation: { score: 1 } },
      { seatIndex: 1, name: "CPU", payout: 50, evaluation: { score: 3 } },
    ]);
  });
});
