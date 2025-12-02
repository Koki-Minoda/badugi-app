import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../engineSnapshotUtils";

describe("mergeEngineSnapshot", () => {
  const baseState = {
    players: [{ id: 1 }],
    pots: [{ total: 100 }],
    gameId: "badugi",
    engineId: "badugi",
    metadata: {
      currentBet: 25,
      betHead: 25,
      lastAggressor: 1,
      actingPlayerIndex: 0,
    },
    currentBet: 25,
    betHead: 25,
    lastAggressor: 1,
    turn: 0,
    deck: [1, 2],
  };

  it("returns the current view when snapshot is empty", () => {
    const merged = mergeEngineSnapshot(baseState, null);
    expect(merged.players).toBe(baseState.players);
    expect(merged.pots).toBe(baseState.pots);
    expect(merged.deck).toBe(baseState.deck);
    expect(merged.metadata.currentBet).toBe(25);
    expect(merged.metadata.lastAggressor).toBe(1);
  });

  it("prefers snapshot data and metadata overrides", () => {
    const snapshot = {
      players: [{ id: 2 }],
      pots: [{ total: 200 }],
      nextTurn: 3,
      metadata: {
        currentBet: 50,
        betHead: 50,
        lastAggressor: 2,
        actingPlayerIndex: 3,
      },
      deck: [3, 4, 5],
    };
    const merged = mergeEngineSnapshot(baseState, snapshot);
    expect(merged.players).toBe(snapshot.players);
    expect(merged.pots).toBe(snapshot.pots);
    expect(merged.deck).toEqual(snapshot.deck);
    expect(merged.metadata.currentBet).toBe(50);
    expect(merged.metadata.betHead).toBe(50);
    expect(merged.metadata.lastAggressor).toBe(2);
    expect(merged.metadata.actingPlayerIndex).toBe(3);
  });

  it("falls back to previous metadata when snapshot metadata partial", () => {
    const snapshot = {
      metadata: {
        currentBet: 60,
      },
    };
    const merged = mergeEngineSnapshot(baseState, snapshot);
    expect(merged.metadata.currentBet).toBe(60);
    expect(merged.metadata.betHead).toBe(baseState.metadata.betHead);
    expect(merged.metadata.lastAggressor).toBe(baseState.metadata.lastAggressor);
    expect(merged.metadata.actingPlayerIndex).toBeNull();
    expect(merged.deck).toEqual([]);
  });

  it("keeps gameId/engineId from snapshot and falls back to base", () => {
    const snapshot = {
      gameId: "badugi",
      engineId: "badugi",
    };
    const merged = mergeEngineSnapshot(baseState, snapshot);
    expect(merged.gameId).toBe("badugi");
    expect(merged.engineId).toBe("badugi");
    const merged2 = mergeEngineSnapshot(baseState, {});
    expect(merged2.gameId).toBe("badugi");
    expect(merged2.engineId).toBe("badugi");
  });
});
