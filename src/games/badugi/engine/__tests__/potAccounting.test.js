import { describe, expect, it } from "vitest";
import { BadugiEngine } from "../BadugiEngine.js";
import { settleStreetToPots } from "../roundFlow.js";

const DEFAULT_STRUCTURE = { sb: 10, bb: 20 };

describe("Badugi pot accounting", () => {
  it("preserves chip totals and aligns pot payouts with stack changes", () => {
    const engine = new BadugiEngine();
    const seatConfig = ["HUMAN", "CPU", "CPU", "CPU"];

    const initialState = engine.initHand({
      seatConfig,
      startingStack: 500,
      dealerIndex: 0,
      structure: DEFAULT_STRUCTURE,
    });
    const initialTotal = sumStacks(initialState.players);

    let state = engine.applyForcedBets(initialState);

    // Pre-draw betting: everyone calls to keep it simple.
    state = engine.applyPlayerAction(state, { seatIndex: 3, type: "CALL" });
    state = engine.applyPlayerAction(state, { seatIndex: 0, type: "CALL" });
    state = engine.applyPlayerAction(state, { seatIndex: 1, type: "CALL" });
    state = engine.applyPlayerAction(state, { seatIndex: 2, type: "CHECK" });

    const { pots, clearedPlayers } = settleStreetToPots(state.players, state.pots ?? []);

    const playersWithHands = clearedPlayers.map((player, idx) => ({
      ...player,
      hand: idx === 2 ? ["AS", "3D", "5C", "7H"] : ["KD", "QS", "9C", "8H"],
    }));

    const preShowdownStacks = playersWithHands.map((p) => p.stack ?? 0);

    const showdown = engine.resolveShowdown(
      {
        ...state,
        players: playersWithHands,
        pots,
      },
      { cloneState: true }
    );

    const resolvedPlayers = showdown.state.players;
    const finalStacks = resolvedPlayers.map((p) => p.stack ?? 0);
    const finalTotal = sumStacks(resolvedPlayers);

    const totalPotAmount = sumPots(pots);
    const totalCollect = sumCollects(showdown.summary);

    expect(totalPotAmount).toBeGreaterThan(0);
    expect(totalCollect).toBe(totalPotAmount);
    expect(finalTotal).toBe(initialTotal);

    showdown.summary.forEach((potSummary) => {
      (potSummary.payouts ?? []).forEach(({ seatIndex, payout }) => {
        const delta = finalStacks[seatIndex] - preShowdownStacks[seatIndex];
        expect(delta).toBe(payout);
      });
    });
  });
});

function sumStacks(players = []) {
  return players.reduce((sum, player) => sum + (player?.stack ?? 0), 0);
}

function sumPots(pots = []) {
  return pots.reduce((sum, pot) => sum + Math.max(0, pot?.amount ?? 0), 0);
}

function sumCollects(summary = []) {
  return summary.reduce(
    (acc, pot) =>
      acc +
      (pot?.payouts ?? []).reduce((subtotal, payout) => subtotal + (payout?.payout ?? 0), 0),
    0
  );
}
