import { describe, it, expect, vi } from "vitest";
import { runDrawRound } from "../../engine/drawRound.js";

function makePlayer(overrides = {}) {
  return {
    name: overrides.name ?? "CPU",
    hand: overrides.hand ?? ["2S", "5D", "8C", "KH"],
    drawRequest: overrides.drawRequest ?? 0,
    stack: overrides.stack ?? 0,
    betThisRound: overrides.betThisRound ?? 0,
    folded: overrides.folded ?? false,
    seatOut: overrides.seatOut ?? false,
    allIn: overrides.allIn ?? false,
    hasDrawn: overrides.hasDrawn ?? false,
    lastDrawCount: overrides.lastDrawCount ?? 0,
    lastAction: overrides.lastAction ?? "",
  };
}

describe("runDrawRound", () => {
  it("allows all-in players to complete the draw phase", () => {
    const players = [
      makePlayer({ name: "Hero", stack: 1000, allIn: false }),
      makePlayer({
        name: "CPU",
        allIn: true,
        stack: 0,
        drawRequest: 2,
        hand: ["3S", "3D", "7C", "9H"],
      }),
    ];
    const deckManager = { draw: vi.fn(() => ["JC", "QD"]) };
    const setPlayers = vi.fn();
    const setTurn = vi.fn();

    runDrawRound({
      players,
      turn: 1,
      deckManager,
      setPlayers,
      drawRound: 0,
      setTurn,
      dealerIdx: 0,
      NUM_PLAYERS: players.length,
      advanceAfterAction: vi.fn(),
      onActionLog: vi.fn(),
    });

    expect(deckManager.draw).toHaveBeenCalledWith(2);
    const updated = setPlayers.mock.calls.at(-1)?.[0];
    expect(updated?.[1]?.hasDrawn).toBe(true);
    expect(updated?.[1]?.lastAction).toBe("DRAW(2)");
  });
});
