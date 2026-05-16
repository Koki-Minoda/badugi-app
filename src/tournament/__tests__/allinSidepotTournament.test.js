import { describe, expect, it } from "vitest";
import {
  buildSidePots,
  buildTournamentTestFixture,
  completeHand,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament all-in and side-pot policy", () => {
  it("builds main and side pots from short-stack all-in contributions", () => {
    const pots = buildSidePots({ 0: 50, 1: 100, 2: 200 });
    expect(pots).toEqual([
      { amount: 150, contributors: [0, 1, 2], eligible: [0, 1, 2] },
      { amount: 100, contributors: [1, 2], eligible: [1, 2] },
      { amount: 100, contributors: [2], eligible: [2] },
    ]);
  });

  it("excludes folded players from side-pot eligibility while preserving contribution totals", () => {
    const pots = buildSidePots({ 0: 50, 1: 100, 2: 100, 3: 100 }, [3]);
    expect(pots.reduce((sum, pot) => sum + pot.amount, 0)).toBe(350);
    expect(pots.at(-1).eligible).not.toContain(3);
  });

  it("busts all-in players only after pot award summary is applied", () => {
    let state = buildTournamentTestFixture("shortStackBust").state;
    const shortStack = Object.values(state.players).find((player) => player.stack === 10);
    expect(shortStack).toBeTruthy();
    state = completeHand(state, shortStack.tableId, [
      { seatIndex: shortStack.seatIndex ?? 0, playerId: shortStack.id, startingStack: 10, stack: 0 },
    ]);
    expect(state.players[shortStack.id].busted).toBe(true);
    expect(state.players[shortStack.id].tableId).toBeNull();
  });
});
