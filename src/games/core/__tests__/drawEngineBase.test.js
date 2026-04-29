import { describe, expect, it } from "vitest";
import { DrawEngineBase } from "../drawEngineBase.js";
import { createTableState } from "../models.js";

class TestDrawEngine extends DrawEngineBase {
  constructor(opts = {}) {
    super({ gameId: "test_draw", displayName: "Test Draw", ...opts });
  }
}

function player(overrides = {}) {
  return {
    seatIndex: overrides.seatIndex ?? 0,
    stack: overrides.stack ?? 100,
    bet: overrides.bet ?? 0,
    totalInvested: overrides.totalInvested ?? 0,
    folded: overrides.folded ?? false,
    allIn: overrides.allIn ?? false,
    sittingOut: overrides.sittingOut ?? false,
    ...overrides,
  };
}

describe("DrawEngineBase", () => {
  it("applies antes and blinds without mutating the original state", () => {
    const engine = new TestDrawEngine();
    const state = createTableState({
      gameId: "test_draw",
      dealerIndex: 0,
      smallBlind: 5,
      bigBlind: 10,
      ante: 1,
      players: [
        player({ seatIndex: 0 }),
        player({ seatIndex: 1 }),
        player({ seatIndex: 2 }),
      ],
    });

    const next = engine.applyForcedBets(state);

    expect(state.players[1].stack).toBe(100);
    expect(next.players[0]).toMatchObject({ stack: 99, bet: 1, lastAction: "ANTE" });
    expect(next.players[1]).toMatchObject({ stack: 94, bet: 6, lastAction: "SB" });
    expect(next.players[2]).toMatchObject({ stack: 89, bet: 11, lastAction: "BB" });
  });

  it("detects betting street completion when active players are matched", () => {
    const engine = new TestDrawEngine();
    const state = createTableState({
      gameId: "test_draw",
      players: [
        player({ seatIndex: 0, bet: 10 }),
        player({ seatIndex: 1, bet: 10 }),
        player({ seatIndex: 2, folded: true, bet: 0 }),
      ],
    });

    expect(engine.shouldAdvanceStreet(state)).toBe(true);
  });

  it("detects betting street completion when no active player can act", () => {
    const engine = new TestDrawEngine();
    const state = createTableState({
      gameId: "test_draw",
      players: [
        player({ seatIndex: 0, bet: 7, allIn: true }),
        player({ seatIndex: 1, bet: 10, allIn: true }),
      ],
    });

    expect(engine.shouldAdvanceStreet(state)).toBe(true);
  });

  it("does not advance an unmatched street while a player can still act", () => {
    const engine = new TestDrawEngine();
    const state = createTableState({
      gameId: "test_draw",
      players: [
        player({ seatIndex: 0, bet: 10 }),
        player({ seatIndex: 1, bet: 5 }),
      ],
    });

    expect(engine.shouldAdvanceStreet(state)).toBe(false);
  });

  it("caps next draw round at maxDrawRounds", () => {
    const engine = new TestDrawEngine({ maxDrawRounds: 2 });

    expect(engine.getNextDrawRound({ drawRoundIndex: 0 })).toBe(1);
    expect(engine.getNextDrawRound({ drawRoundIndex: 2 })).toBe(2);
  });

  it("requires concrete engines to implement action handling", () => {
    const engine = new TestDrawEngine();

    expect(() => engine.applyPlayerAction()).toThrow(/applyPlayerAction/);
  });
});
