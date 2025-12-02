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

    expect(deckManager.draw).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        activeCards: expect.any(Array),
      }),
    );
    const updated = setPlayers.mock.calls.at(-1)?.[0];
    expect(updated?.[1]?.hasDrawn).toBe(true);
    expect(updated?.[1]?.lastAction).toBe("DRAW(2)");
  });

  it("reassigns the draw turn to the next drawable seat even if they are all-in", () => {
    const players = [
      makePlayer({ name: "SB", folded: true, hasDrawn: true }),
      makePlayer({
        name: "BB",
        allIn: true,
        stack: 0,
        drawRequest: 1,
        hand: ["2C", "4D", "7S", "9H"],
        hasDrawn: false,
      }),
      makePlayer({ name: "CPU 3", hasDrawn: true }),
    ];
    const setPlayers = vi.fn();
    const setTurn = vi.fn();

    runDrawRound({
      players,
      turn: 0,
      deckManager: {},
      setPlayers,
      drawRound: 0,
      setTurn,
      dealerIdx: 0,
      NUM_PLAYERS: players.length,
      advanceAfterAction: vi.fn(),
      onActionLog: vi.fn(),
    });

    expect(setTurn).toHaveBeenCalledWith(1);
    expect(setPlayers).not.toHaveBeenCalled();
  });

  it("lets an all-in BB complete the draw rotation after the SB folds", () => {
    let players = [
      makePlayer({
        name: "SB",
        folded: true,
        hasDrawn: true,
        hand: ["2C", "5H", "8D", "KS"],
      }),
      makePlayer({
        name: "BB",
        allIn: true,
        stack: 0,
        drawRequest: 2,
        hand: ["3C", "6H", "9D", "QS"],
      }),
      makePlayer({
        name: "CPU 2",
        drawRequest: 1,
        hand: ["4C", "7H", "10D", "AS"],
      }),
      makePlayer({
        name: "CPU 3",
        drawRequest: 1,
        hand: ["5C", "8H", "JD", "2S"],
      }),
      makePlayer({
        name: "CPU 4",
        drawRequest: 1,
        hand: ["6C", "9H", "QD", "3S"],
      }),
      makePlayer({
        name: "CPU 5",
        drawRequest: 1,
        hand: ["7C", "10H", "KD", "4S"],
      }),
    ];
    let cardCounter = 0;
    const deckManager = {
      draw: vi.fn((count) => {
        const cards = [];
        for (let i = 0; i < count; i += 1) {
          cardCounter += 1;
          cards.push(`X${cardCounter}`);
        }
        return cards;
      }),
      discard: vi.fn(),
    };
    const advanceAfterAction = vi.fn();
    const onActionLog = vi.fn();
    const setTurn = vi.fn();
    const setPlayers = vi.fn((next) => {
      players = next;
    });

    const runAndSync = (seat) => {
      runDrawRound({
        players,
        turn: seat,
        deckManager,
        setPlayers,
        drawRound: 0,
        setTurn,
        dealerIdx: 0,
        NUM_PLAYERS: players.length,
        advanceAfterAction,
        onActionLog,
      });
    };

    [1, 2, 3, 4, 5].forEach((seat) => runAndSync(seat));

    const eligible = players.filter((p) => !p.folded && !p.seatOut);
    expect(eligible.every((p) => p.hasDrawn)).toBe(true);
    expect(deckManager.draw).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ activeCards: expect.any(Array) }),
    );
  });
});
