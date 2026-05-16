import { describe, expect, it } from "vitest";
import {
  buildTournamentTestFixture,
  runBackgroundTournamentToCompletion,
  simulateBackgroundTables,
  validateUniqueActivePlayers,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament CPU lifecycle", () => {
  it("simulates CPU hands without freezing or invalid stacks", () => {
    let state = buildTournamentTestFixture("default", { entrantCount: 6 }).state;
    state = simulateBackgroundTables(state, null, { maxHandsPerTable: 2 });
    Object.values(state.players).forEach((player) => {
      expect(Number.isFinite(player.stack)).toBe(true);
      expect(player.stack).toBeGreaterThanOrEqual(0);
    });
    expect(validateUniqueActivePlayers(state).valid).toBe(true);
  });

  it("does not reseat busted CPUs after background busts and rebalance", () => {
    let state = buildTournamentTestFixture("tableRebalance").state;
    state.players["cpu-1"].stack = 1;
    state = simulateBackgroundTables(state, null, { maxHandsPerTable: 3 });
    expect(validateUniqueActivePlayers(state).valid).toBe(true);
    Object.values(state.players)
      .filter((player) => player.busted)
      .forEach((player) => expect(player.tableId).toBeNull());
  });

  it("can produce a CPU champion safely", () => {
    const { state, iterations } = runBackgroundTournamentToCompletion(
      buildTournamentTestFixture("cpuChampion", { entrantCount: 4 }).state,
      50,
    );
    expect(iterations).toBeLessThan(50);
    expect(state.isFinished).toBe(true);
    expect(state.championId).toBeTruthy();
  });
});
