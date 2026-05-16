import { describe, expect, it } from "vitest";
import {
  buildTournamentTestFixture,
  completeHand,
  restoreResumeSnapshot,
  serializeResumeSnapshot,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament start, resume, and retire fixtures", () => {
  it("creates a valid new tournament snapshot", () => {
    const { state } = buildTournamentTestFixture("default", { variant: "D01" });
    expect(state.config.gameVariant).toBe("D01");
    expect(state.playersRemaining).toBe(6);
    expect(state.tables[0].seats.filter((seat) => seat.playerId).length).toBe(6);
  });

  it("restores level, stacks, tables, and hero identity from a hand-boundary snapshot", () => {
    let state = buildTournamentTestFixture("blindLevelUp").state;
    state = completeHand(state, state.tables[0].tableId, [], 1);
    const restored = restoreResumeSnapshot(serializeResumeSnapshot(state));
    expect(restored.levelIndex).toBe(state.levelIndex);
    expect(restored.players.hero.stack).toBe(state.players.hero.stack);
    expect(restored.tables[0].seats[0].playerId).toBe("hero");
  });

  it("fails safely for missing or incompatible snapshots", () => {
    expect(restoreResumeSnapshot(null)).toBeNull();
    expect(restoreResumeSnapshot({ version: 999, state: {} })).toBeNull();
  });
});
