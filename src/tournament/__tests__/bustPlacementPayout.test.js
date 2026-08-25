import { describe, expect, it } from "vitest";
import {
  buildTournamentTestFixture,
  completeHand,
  computePayouts,
  finishTournamentToChampion,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament bust, placement, and payout", () => {
  it("assigns unique placements for multiple same-hand busts by start-of-hand stack", () => {
    let state = buildTournamentTestFixture("payout").state;
    const [high, mid, low] = Object.values(state.players).slice(0, 3);
    high.stack = 300;
    mid.stack = 200;
    low.stack = 100;
    state = completeHand(state, state.tables[0].tableId, [
      { seatIndex: high.seatIndex ?? 0, playerId: high.id, startingStack: high.stack, stack: 0 },
      { seatIndex: mid.seatIndex ?? 1, playerId: mid.id, startingStack: mid.stack, stack: 0 },
      { seatIndex: low.seatIndex ?? 2, playerId: low.id, startingStack: low.stack, stack: 0 },
    ]);

    const places = [high.id, mid.id, low.id].map((id) => state.players[id].finishPlace);
    expect(new Set(places).size).toBe(3);
    expect(state.players[high.id].finishPlace).toBeLessThan(state.players[mid.id].finishPlace);
    expect(state.players[mid.id].finishPlace).toBeLessThan(state.players[low.id].finishPlace);
  });

  it("preserves prize pool and pays only ITM placements", () => {
    let state = buildTournamentTestFixture("payout").state;
    const champion = Object.values(state.players)[0].id;
    state = finishTournamentToChampion(state, champion);
    state = computePayouts(state);
    const prizePool = state.config.startingStack * state.totalPlayers;
    const payoutSum = Object.values(state.players).reduce((sum, player) => sum + (player.payout ?? 0), 0);
    expect(payoutSum).toBe(prizePool);
    expect(state.players[champion].payout).toBeGreaterThan(0);
    Object.values(state.players)
      .filter((player) => player.finishPlace > 2)
      .forEach((player) => expect(player.payout).toBe(0));
  });

  it("is idempotent — calling computePayouts twice yields the same payout values", () => {
    let state = buildTournamentTestFixture("payout").state;
    const champion = Object.values(state.players)[0].id;
    state = finishTournamentToChampion(state, champion);

    computePayouts(state);
    const payoutsAfterFirst = Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, player.payout]),
    );

    computePayouts(state);
    const payoutsAfterSecond = Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, player.payout]),
    );

    expect(payoutsAfterSecond).toEqual(payoutsAfterFirst);
  });

  it("does not replace the config.payouts array reference", () => {
    let state = buildTournamentTestFixture("payout").state;
    const champion = Object.values(state.players)[0].id;
    // Capture the reference before any payout computation.
    const originalPayoutsRef = state.config.payouts;

    state = finishTournamentToChampion(state, champion);
    computePayouts(state);

    // computePayouts reads config.payouts but must not reassign it.
    expect(state.config.payouts).toBe(originalPayoutsRef);
  });

  it("mutates state in place — return value is the same object reference", () => {
    let state = buildTournamentTestFixture("payout").state;
    const champion = Object.values(state.players)[0].id;
    state = finishTournamentToChampion(state, champion);

    // Mutation is intentional: callers must not assume a new state is returned.
    const returnedState = computePayouts(state);
    expect(returnedState).toBe(state);
  });
});
