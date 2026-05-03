import { describe, expect, it } from "vitest";
import { BoardEngineBase } from "../boardEngineBase.js";
import { createTableState } from "../models.js";

class TestBoardEngine extends BoardEngineBase {
  constructor(opts = {}) {
    super({ gameId: "test_board", displayName: "Test Board", ...opts });
  }
}

function player(overrides = {}) {
  return {
    seatIndex: overrides.seatIndex ?? 0,
    stack: overrides.stack ?? 100,
    bet: overrides.bet ?? 0,
    sittingOut: false,
    seatOut: false,
    isBusted: false,
    ...overrides,
  };
}

describe("BoardEngineBase", () => {
  it("skips busted seats when posting blinds", () => {
    const engine = new TestBoardEngine();
    const state = createTableState({
      gameId: "test_board",
      dealerIndex: 3,
      smallBlind: 15,
      bigBlind: 30,
      players: [
        player({ seatIndex: 0, stack: 1100 }),
        player({ seatIndex: 1, stack: 230 }),
        player({ seatIndex: 2, stack: 0, seatOut: true, isBusted: true }),
        player({ seatIndex: 3, stack: 1350 }),
        player({ seatIndex: 4, stack: 275 }),
        player({ seatIndex: 5, stack: 0, seatOut: true, isBusted: true }),
      ],
    });

    const next = engine.applyForcedBets(state);

    expect(next.players[4]).toMatchObject({ stack: 260, bet: 15, lastAction: "SB" });
    expect(next.players[0]).toMatchObject({ stack: 1070, bet: 30, lastAction: "BB" });
    expect(next.players[5]).toMatchObject({ stack: 0, bet: 0 });
    expect(next.metadata.lastBlinds).toEqual({ sbIndex: 4, bbIndex: 0 });
  });
});
