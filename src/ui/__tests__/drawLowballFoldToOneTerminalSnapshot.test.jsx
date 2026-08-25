import { describe, expect, it } from "vitest";
import { mergeEngineSnapshot } from "../utils/engineSnapshotUtils.js";

describe("draw lowball fold-to-one terminal snapshot", () => {
  it("does not preserve stale hero actor metadata after collect terminal", () => {
    const merged = mergeEngineSnapshot(
      {
        players: [
          { name: "Hero", lastAction: "Call" },
          { name: "CPU 2", folded: true },
          { name: "CPU 3", folded: true },
        ],
        metadata: { actingPlayerIndex: 0, currentBet: 20 },
      },
      {
        gameId: "deuce_to_seven_triple_draw",
        variantId: "D01",
        phase: "SHOWDOWN",
        street: "SHOWDOWN",
        nextTurn: null,
        turn: null,
        currentActor: null,
        actingPlayerIndex: null,
        currentBet: 0,
        players: [
          { name: "Hero", lastAction: "Collect 90", stack: 590, betThisRound: 0 },
          { name: "CPU 2", folded: true, hasFolded: true, lastAction: "Fold", stack: 480, betThisRound: 0 },
          { name: "CPU 3", folded: true, hasFolded: true, lastAction: "Fold", stack: 430, betThisRound: 0 },
        ],
        metadata: { actingPlayerIndex: null, currentBet: 0 },
        lastHandResult: {
          pot: 90,
          winners: [{ seatIndex: 0, name: "Hero", payout: 90 }],
        },
      },
    );

    expect(merged.metadata.actingPlayerIndex).toBeNull();
    expect(merged.metadata.currentBet).toBe(0);
    expect(merged.players[0].lastAction).toBe("Collect 90");
  });
});
