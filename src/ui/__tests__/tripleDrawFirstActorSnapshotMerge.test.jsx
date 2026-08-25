import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";

describe("Triple Draw first actor snapshot merge", () => {
  it("uses controller nextTurn as source of truth over stale metadata actingPlayerIndex", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero" }, { name: "SB" }, { name: "BB" }, { name: "UTG" }],
        metadata: { actingPlayerIndex: 2 },
      },
      {
        gameId: "ace_to_five_triple_draw",
        variantId: "D02",
        players: [{ name: "Hero" }, { name: "SB" }, { name: "BB" }, { name: "UTG" }],
        phase: "BET",
        nextTurn: 3,
        turn: 3,
        metadata: { actingPlayerIndex: 2, currentBet: 20 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBe(3);
  });

  it("clears hero acting state when controller has no next actor", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero" }, { name: "CPU" }],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        gameId: "deuce_to_seven_single_draw",
        variantId: "S01",
        players: [{ name: "Hero" }, { name: "CPU" }],
        phase: "SHOWDOWN",
        nextTurn: null,
        turn: null,
        metadata: { actingPlayerIndex: 0, currentBet: 0 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBeNull();
  });

  it("keeps hero controls aligned with canonical actor after a hero action", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [
          { name: "Hero", lastAction: "Check" },
          { name: "CPU 2" },
          { name: "CPU 3" },
        ],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        gameId: "ace_to_five_single_draw",
        variantId: "S02",
        players: [
          { name: "Hero", lastAction: "Check" },
          { name: "CPU 2" },
          { name: "CPU 3" },
        ],
        phase: "BET",
        nextTurn: 1,
        turn: 1,
        metadata: { actingPlayerIndex: 0, currentBet: 0 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBe(1);
    expect(merged.players[0].lastAction).toBe("Check");
  });
});
