import { describe, expect, it } from "vitest";
import {
  buildTournamentTestFixture,
  completeHand,
  validateUniqueActivePlayers,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament table rebalance", () => {
  it("removes empty tables and preserves unique active seating", () => {
    let state = buildTournamentTestFixture("tableRebalance").state;
    const toBust = Object.values(state.players).slice(0, 6);
    state = completeHand(
      state,
      state.tables[0].tableId,
      toBust.map((player) => ({
        seatIndex: player.seatIndex ?? 0,
        playerId: player.id,
        startingStack: player.stack,
        stack: 0,
      })),
    );

    expect(state.tables.filter((table) => table.isActive)).toHaveLength(1);
    const uniqueness = validateUniqueActivePlayers(state);
    expect(uniqueness.valid).toBe(true);
    expect(uniqueness.activePlayerCount).toBe(state.playersRemaining);
  });

  it("handles odd player counts without duplicate or missing players", () => {
    let state = buildTournamentTestFixture("tableRebalance").state;
    const toBust = Object.values(state.players).slice(0, 5);
    state = completeHand(
      state,
      state.tables[0].tableId,
      toBust.map((player) => ({
        seatIndex: player.seatIndex ?? 0,
        playerId: player.id,
        startingStack: player.stack,
        stack: 0,
      })),
    );

    const activeCounts = state.tables
      .filter((table) => table.isActive)
      .map((table) => table.seats.filter((seat) => seat.playerId).length);
    expect(Math.max(...activeCounts) - Math.min(...activeCounts)).toBeLessThanOrEqual(1);
    expect(validateUniqueActivePlayers(state).valid).toBe(true);
  });
});
