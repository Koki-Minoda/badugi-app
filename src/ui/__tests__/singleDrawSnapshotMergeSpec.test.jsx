import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";

const variants = [
  ["S01", "deuce_to_seven_single_draw"],
  ["S02", "ace_to_five_single_draw"],
];

describe("Single Draw snapshot merge spec", () => {
  it.each(variants)("%s controller nextTurn is source of truth over stale metadata actingPlayerIndex", (variantId, gameId) => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero" }, { name: "SB" }, { name: "BB" }, { name: "UTG" }],
        metadata: { actingPlayerIndex: 2 },
      },
      {
        gameId,
        variantId,
        players: [{ name: "Hero" }, { name: "SB" }, { name: "BB" }, { name: "UTG" }],
        phase: "BET",
        nextTurn: 3,
        turn: 3,
        metadata: { actingPlayerIndex: 2, currentBet: 20 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBe(3);
  });

  it.each(variants)("%s hero controls are aligned with canonical actor after hero action", (variantId, gameId) => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero", lastAction: "Call" }, { name: "CPU" }],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        gameId,
        variantId,
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

  it.each(variants)("%s clears acting player at terminal state", (variantId, gameId) => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero" }, { name: "CPU" }],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        gameId,
        variantId,
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
