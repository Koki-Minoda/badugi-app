import { describe, expect, it } from "vitest";
import { BadugiEngine } from "../BadugiEngine.js";
import { buildHandResultSummary } from "../../flow/handResultUtils.js";
import { evaluateBadugi } from "../../utils/badugiEvaluator.js";

function buildPlayer({ name, stack, totalInvested, hand, folded = false }) {
  return {
    name,
    stack,
    totalInvested,
    betThisRound: 0,
    folded,
    seatOut: false,
    hand,
  };
}

describe("Badugi payout integrity", () => {
  it("reconciles pot totals and stack deltas for a single-pot showdown", () => {
    const engine = new BadugiEngine();
    const startStacks = [380, 380, 400, 360, 380, 380];
    const contributions = 20;
    const baseHands = [
      ["KD", "KD", "9H", "4C"],
      ["QH", "8D", "7C", "7S"],
      ["4C", "2H", "5D", "AS"], // clear winner (wheel)
      ["KC", "QC", "7H", "6D"],
      ["TD", "8H", "5S", "5C"],
      ["JD", "9C", "6H", "6S"],
    ];

    const state = {
      gameId: "badugi",
      engineId: "badugi",
      players: startStacks.map((startStack, idx) =>
        buildPlayer({
          name: `Seat ${idx}`,
          stack: startStack - contributions,
          totalInvested: contributions,
          hand: baseHands[idx],
        })
      ),
      pots: [],
      metadata: {},
    };

    const showdown = engine.resolveShowdown(state, { cloneState: true });
    expect(showdown.totalPot).toBe(120);
    expect(showdown.summary).toHaveLength(1);
    expect(showdown.summary[0].potAmount).toBe(120);
    expect(showdown.summary[0].payouts).toHaveLength(1);
    expect(showdown.summary[0].payouts[0]).toMatchObject({ seatIndex: 2, payout: 120 });

    const finalStacks = showdown.state.players.map((player) => player.stack);
    const deltaSum = finalStacks.reduce((sum, stack, idx) => sum + (stack - startStacks[idx]), 0);
    expect(deltaSum).toBe(0);
    expect(finalStacks[2] - startStacks[2]).toBe(100);
    finalStacks.forEach((stack, idx) => {
      if (idx === 2) return;
      expect(stack).toBe(startStacks[idx] - contributions);
    });

    const uiSummary = buildHandResultSummary({
      players: showdown.state.players,
      summary: showdown.summary,
      totalPot: showdown.totalPot,
      evaluateHand: evaluateBadugi,
      handId: "integrity-1",
    });

    expect(uiSummary.potDetails[0].winners).toHaveLength(1);
    expect(uiSummary.potDetails[0].winners[0]).toMatchObject({ seatIndex: 2, payout: 120 });
  });
});
