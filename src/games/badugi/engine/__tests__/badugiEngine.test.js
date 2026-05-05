import { describe, it, expect } from "vitest";
import { BadugiEngine } from "../BadugiEngine.js";

const seat = (overrides = {}) => ({
  name: overrides.name ?? "Seat",
  stack: overrides.stack ?? 100,
  betThisRound: overrides.betThisRound ?? 10,
  totalInvested: overrides.totalInvested ?? 10,
  folded: overrides.folded ?? false,
  allIn: overrides.allIn ?? false,
  seatOut: overrides.seatOut ?? false,
  hand: overrides.hand ?? ["AS", "2D", "3H", "4C"],
});

describe("BadugiEngine phase transitions", () => {
  it("advances from BET into DRAW when draws remain", () => {
    const engine = new BadugiEngine();
    const state = {
      gameId: "badugi",
      engineId: "badugi",
      players: [seat({ name: "BTN" }), seat({ name: "SB" }), seat({ name: "BB" }), seat({ name: "UTG" })],
      pots: [],
      dealerIndex: 0,
      drawRoundIndex: 0,
      metadata: {},
    };

    const result = engine.advanceAfterBet(state, {
      drawRound: 0,
      maxDraws: 3,
      dealerIndex: 0,
      numPlayers: state.players.length,
    });

    expect(result.street).toBe("DRAW");
    expect(result.drawRoundIndex).toBe(1);
    expect(result.actingPlayerIndex).not.toBeNull();
  });

  it("keeps all-in live players eligible for draw decisions", () => {
    const engine = new BadugiEngine();
    const state = {
      gameId: "badugi",
      engineId: "badugi",
      players: [
        seat({ name: "Hero", stack: 0, allIn: true, betThisRound: 10, totalInvested: 10 }),
        seat({ name: "Villain", stack: 90, betThisRound: 10, totalInvested: 10 }),
      ],
      pots: [],
      dealerIndex: 1,
      drawRoundIndex: 0,
      metadata: {},
    };

    const result = engine.advanceAfterBet(state, {
      drawRound: 0,
      maxDraws: 3,
      dealerIndex: 1,
      numPlayers: state.players.length,
    });

    expect(result.street).toBe("DRAW");
    expect(result.state.players[0].allIn).toBe(true);
    expect(result.state.players[0].canDraw).toBe(true);
    expect(result.state.players[0].hasActedThisRound).toBe(false);
    expect(result.actingPlayerIndex).toBe(0);
  });

  it("moves directly into SHOWDOWN when no draws remain", () => {
    const engine = new BadugiEngine();
    const state = {
      gameId: "badugi",
      engineId: "badugi",
      players: [seat({ name: "Hero" }), seat({ name: "Villain" })],
      pots: [],
      dealerIndex: 0,
      drawRoundIndex: 0,
      metadata: {},
    };

    const result = engine.advanceAfterBet(state, {
      drawRound: 0,
      maxDraws: 0,
      dealerIndex: 0,
      numPlayers: state.players.length,
    });

    expect(result.street).toBe("SHOWDOWN");
    expect(result.drawRoundIndex).toBe(0);
    expect(result.showdown).toBe(true);
  });
});
