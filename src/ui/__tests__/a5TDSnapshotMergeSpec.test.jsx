import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";

describe("A-5 Triple Draw snapshot merge spec", () => {
  it("controller nextTurn is source of truth over stale metadata actingPlayerIndex", () => {
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

  it("hero controls are aligned with canonical actor after hero action", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero", lastAction: "Call" }, { name: "CPU" }],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        gameId: "ace_to_five_triple_draw",
        variantId: "D02",
        players: [{ name: "Hero", lastAction: "Call" }, { name: "CPU" }],
        phase: "BET",
        nextTurn: 1,
        turn: 1,
        metadata: { actingPlayerIndex: 0, currentBet: 20 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBe(1);
    expect(merged.players[0].lastAction).toBe("Call");
  });

  it("clears acting player at terminal state", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero" }, { name: "CPU" }],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        gameId: "ace_to_five_triple_draw",
        variantId: "D02",
        players: [{ name: "Hero" }, { name: "CPU" }],
        phase: "SHOWDOWN",
        nextTurn: null,
        turn: null,
        metadata: { actingPlayerIndex: 0, currentBet: 0 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBeNull();
  });
});

