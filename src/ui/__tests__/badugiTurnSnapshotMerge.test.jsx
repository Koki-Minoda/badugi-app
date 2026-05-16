import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";

describe("Badugi turn snapshot merge", () => {
  it("prefers canonical nextTurn over stale metadata actingPlayerIndex", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero" }, { name: "Mina" }, { name: "Ren" }],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        players: [{ name: "Hero" }, { name: "Mina" }, { name: "Ren" }],
        nextTurn: 2,
        turn: 2,
        metadata: { actingPlayerIndex: 0, currentBet: 0 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBe(2);
  });

  it("does not resurrect hero turn from metadata when controller has no next actor", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [{ name: "Hero" }, { name: "Mina" }],
        metadata: { actingPlayerIndex: 0 },
      },
      {
        players: [{ name: "Hero" }, { name: "Mina" }],
        nextTurn: null,
        turn: null,
        metadata: { actingPlayerIndex: 0, currentBet: 0 },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBeNull();
  });
});
