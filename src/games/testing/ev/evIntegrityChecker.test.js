import { describe, expect, it } from "vitest";
import { compareEvaluations } from "../../evaluators/registry.js";
import { evaluateBadugiHand } from "../../evaluators/badugi.js";
import { evaluateLowHand } from "../../evaluators/low.js";
import { extractPayouts, validateHandEvIntegrity } from "./evIntegrityChecker.js";

function player(seatIndex, stack, extra = {}) {
  return {
    seatIndex,
    playerId: `p${seatIndex}`,
    stack,
    ...extra,
  };
}

function state(players, extra = {}) {
  return { players, ...extra };
}

function expectError(result, code) {
  expect(result.errors.map((error) => error.code)).toContain(code);
}

function bestSeatByEvaluation(entries) {
  const sorted = [...entries].sort((left, right) => compareEvaluations(left.evaluation, right.evaluation));
  return sorted[0].seatIndex;
}

describe("EV integrity checker", () => {
  it("EV-001 preserves chip totals when strict chip conservation is requested", () => {
    const beforeState = state([player(0, 90), player(1, 90)], { pot: 20 });
    const afterState = state([player(0, 120), player(1, 80)], { pot: 0 });
    const result = validateHandEvIntegrity({
      beforeState,
      afterState,
      result: { pot: 20, winners: [{ seatIndex: 0, amount: 20 }] },
      options: { strictChipConservation: true },
    });
    expect(result.ok).toBe(true);
  });

  it("EV-002 rejects pot payout mismatch", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 115), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: 0, amount: 15 }] },
    });
    expectError(check, "pot_payout_mismatch");
  });

  it("EV-003 rejects folded winners", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120, { folded: true }), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: 0, amount: 20 }] },
    });
    expectError(check, "folded_player_winner");
  });

  it("EV-004 rejects all-in side pot eligibility violations", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 0, { allIn: true }), player(1, 50), player(2, 50)], { pot: 100 }),
      afterState: state([player(0, 100, { allIn: true }), player(1, 0), player(2, 0)], { pot: 0 }),
      result: {
        totalPot: 100,
        potDetails: [
          { amount: 60, eligibleSeatIndexes: [0, 1, 2], winners: [{ seatIndex: 0, amount: 60 }] },
          { amount: 40, eligibleSeatIndexes: [1, 2], winners: [{ seatIndex: 0, amount: 40 }] },
        ],
      },
    });
    expectError(check, "winner_not_pot_eligible");
  });

  it("EV-005 detects duplicate payout entries", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: {
        pot: 20,
        winners: [
          { seatIndex: 0, amount: 10, potIndex: 0, component: "main" },
          { seatIndex: 0, amount: 10, potIndex: 0, component: "main" },
        ],
      },
    });
    expectError(check, "duplicate_payout");
  });

  it("EV-006 flags fake side pots when side pots are not allowed", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: {
        totalPot: 20,
        potDetails: [
          { amount: 10, winners: [{ seatIndex: 0, amount: 10 }] },
          { amount: 10, winners: [{ seatIndex: 0, amount: 10 }] },
        ],
      },
      options: { allowSidePot: false },
    });
    expectError(check, "fake_side_pot");
  });

  it("EV-007 rejects non-finite rewards", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: 0, amount: 20 }], rewardBySeat: { 0: Number.NaN, 1: 0 } },
    });
    expectError(check, "reward_not_finite");
  });

  it("EV-008 and EV-010 reject rewards that disagree with stack delta", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: 0, amount: 20 }], rewardBySeat: { 0: -30, 1: 30 } },
    });
    expectError(check, "reward_stack_delta_mismatch");
  });

  it("EV-009 rejects non-zero-sum terminal rewards", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: 0, amount: 20 }], rewardBySeat: { 0: 30, 1: -20 } },
    });
    expectError(check, "reward_sum_not_zero");
  });

  it("EV-011 confirms Badugi evaluator winner consistency", () => {
    const entries = [
      { seatIndex: 0, evaluation: evaluateBadugiHand({ cards: ["AS", "2D", "3C", "4H"] }) },
      { seatIndex: 1, evaluation: evaluateBadugiHand({ cards: ["KC", "QD", "JH", "10S"] }) },
    ];
    const expectedWinner = bestSeatByEvaluation(entries);
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: expectedWinner, amount: 20 }] },
      variant: { id: "D03" },
      options: { expectedWinnerSeatIndexes: [expectedWinner] },
    });
    expect(check.ok).toBe(true);
  });

  it("EV-012 confirms 2-7 low evaluator winner consistency", () => {
    const entries = [
      { seatIndex: 0, evaluation: evaluateLowHand({ cards: ["7S", "5D", "4C", "3H", "2S"], lowType: "27" }) },
      { seatIndex: 1, evaluation: evaluateLowHand({ cards: ["8S", "6D", "5C", "4H", "2S"], lowType: "27" }) },
    ];
    const expectedWinner = bestSeatByEvaluation(entries);
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: expectedWinner, amount: 20 }] },
      variant: { id: "D01" },
      options: { expectedWinnerSeatIndexes: [expectedWinner] },
    });
    expect(check.ok).toBe(true);
  });

  it("EV-013 confirms A-5 low evaluator winner consistency", () => {
    const entries = [
      { seatIndex: 0, evaluation: evaluateLowHand({ cards: ["AS", "2D", "3C", "4H", "5S"], lowType: "A5" }) },
      { seatIndex: 1, evaluation: evaluateLowHand({ cards: ["2S", "3D", "4C", "5H", "6S"], lowType: "A5" }) },
    ];
    const expectedWinner = bestSeatByEvaluation(entries);
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 120), player(1, 80)], { pot: 0 }),
      result: { pot: 20, winners: [{ seatIndex: expectedWinner, amount: 20 }] },
      variant: { id: "D02" },
      options: { expectedWinnerSeatIndexes: [expectedWinner] },
    });
    expect(check.ok).toBe(true);
  });

  it("EV-014 validates split pot component totals", () => {
    const check = validateHandEvIntegrity({
      beforeState: state([player(0, 90), player(1, 90)], { pot: 20 }),
      afterState: state([player(0, 100), player(1, 100)], { pot: 0 }),
      result: {
        totalPot: 20,
        potDetails: [{ amount: 20, highWinners: [{ seatIndex: 0 }], lowWinners: [{ seatIndex: 1 }] }],
      },
    });
    expect(check.ok).toBe(true);
    expect(check.metrics.payoutTotal).toBe(20);
  });

  it("EV-015 applies deterministic odd chip splitting", () => {
    const payouts = extractPayouts({ pot: 5, winners: [{ seatIndex: 0 }, { seatIndex: 1 }] });
    expect(payouts.map((payout) => payout.amount)).toEqual([3, 2]);
  });
});
