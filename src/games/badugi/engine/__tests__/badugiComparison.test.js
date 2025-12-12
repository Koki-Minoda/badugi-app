import { describe, expect, it } from "vitest";
import { BadugiEngine } from "../BadugiEngine.js";
import { buildHandResultSummary } from "../../flow/handResultUtils.js";
import { evaluateBadugi } from "../../utils/badugiEvaluator.js";

describe("Badugi showdown comparisons", () => {
  it("ensures four-card Badugi beats three-card hands in UI summaries", () => {
    const engine = new BadugiEngine();
    const state = {
      gameId: "badugi",
      engineId: "badugi",
      players: [
        {
          name: "Hero",
          stack: 1000,
          betThisRound: 0,
          folded: false,
          seatOut: false,
          hand: ["9D", "2H", "5C", "JS"],
        },
        {
          name: "CPU 3",
          stack: 1000,
          betThisRound: 0,
          folded: false,
          seatOut: false,
          hand: ["6S", "AH", "3H", "2C"],
        },
      ],
      pots: [
        {
          amount: 400,
          eligible: [0, 1],
        },
      ],
      metadata: {},
    };

    const showdown = engine.resolveShowdown(state, { cloneState: true });
    const firstPayout = showdown.summary?.[0]?.payouts?.[0];
    expect(firstPayout?.seatIndex).toBe(0);

    const uiSummary = buildHandResultSummary({
      players: showdown.state.players,
      summary: showdown.summary,
      totalPot: showdown.totalPot,
      handId: "regression-badugi-size",
      evaluateHand: evaluateBadugi,
      buttonSeat: 5,
      sbSeat: 0,
      bbSeat: 1,
    });

    expect(uiSummary.winners).toHaveLength(1);
    expect(uiSummary.winners[0]).toMatchObject({ seatIndex: 0, name: "Hero" });
    expect(uiSummary).toMatchObject({ buttonSeat: 5, sbSeat: 0, bbSeat: 1 });
  });

  it("ignores folded seats when resolving showdown", () => {
    const engine = new BadugiEngine();
    const state = {
      gameId: "badugi",
      engineId: "badugi",
      players: [
        {
          name: "Hero",
          stack: 100,
          betThisRound: 0,
          folded: false,
          seatOut: false,
          hand: ["9D", "2H", "5C", "JS"],
        },
        {
          name: "Villain",
          stack: 100,
          betThisRound: 0,
          folded: true,
          seatOut: false,
          hand: ["6S", "AH", "3H", "2C"],
        },
      ],
      pots: [{ amount: 200, eligible: [0, 1] }],
      metadata: {},
    };

    const showdown = engine.resolveShowdown(state, { cloneState: true });
    expect(showdown.summary?.[0]?.payouts).toHaveLength(1);
    expect(showdown.summary[0].payouts[0]).toMatchObject({ seatIndex: 0, name: "Hero" });
  });
});
