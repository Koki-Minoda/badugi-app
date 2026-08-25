import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finishBetRoundFrom } from "../roundFlow.jsx";

const BASE = {
  pots: [],
  drawRound: 0,
  dealerIdx: 0,
  NUM_PLAYERS: 2,
  MAX_DRAWS: 3,
};

function makeMocks() {
  return {
    setPlayers: vi.fn(),
    setPots: vi.fn(),
    setPhase: vi.fn(),
    setTurn: vi.fn(),
    setBetHead: vi.fn(),
    setDrawRound: vi.fn(),
    setTransitioning: vi.fn(),
    onPhaseTransition: vi.fn(),
    onEngineSync: vi.fn(),
    runShowdown: vi.fn(),
  };
}

function makePlayer(overrides = {}) {
  const seat = overrides.seat ?? 0;
  return {
    isSeated: true,
    isActiveInGame: true,
    seat,
    name: `P${seat}`,
    folded: false,
    allIn: false,
    betThisRound: 0,
    hasActedThisRound: true,
    stack: 100,
    ...overrides,
  };
}

function runFinish(overrides = {}) {
  const mocks = overrides.mocks ?? makeMocks();
  const players =
    overrides.players ?? [makePlayer({ seat: 0 }), makePlayer({ seat: 1 })];

  finishBetRoundFrom({
    ...BASE,
    ...mocks,
    ...overrides,
    mocks: undefined,
    players,
  });

  return mocks;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("finishBetRoundFrom", () => {
  it("guards undefined drawRound and still advances", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mocks = runFinish({ drawRound: undefined });

    expect(warn).toHaveBeenCalled();
    expect(mocks.setPhase).toHaveBeenCalled();
  });

  it("continues BET when action is incomplete", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mocks = runFinish({
      players: [
        makePlayer({ seat: 0, betThisRound: 10, hasActedThisRound: true }),
        makePlayer({ seat: 1, betThisRound: 0, hasActedThisRound: false }),
      ],
    });

    expect(warn).toHaveBeenCalled();
    expect(mocks.setTurn).toHaveBeenCalledWith(1);
    expect(mocks.setBetHead).toHaveBeenCalledWith(1);
    expect(mocks.setPhase).not.toHaveBeenCalled();
    expect(mocks.setPots).toHaveBeenCalledTimes(1);
  });

  it("moves to SHOWDOWN on the final round", () => {
    const mocks = runFinish({
      drawRound: 3,
      MAX_DRAWS: 3,
    });

    expect(mocks.setPhase).toHaveBeenCalledWith("SHOWDOWN");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("DRAW");
  });

  it("moves to DRAW mid-game", () => {
    const mocks = runFinish({
      drawRound: 0,
    });

    expect(mocks.setPhase).toHaveBeenCalledWith("DRAW");
    expect(mocks.setDrawRound).toHaveBeenCalledWith(1);
    expect(mocks.setPlayers.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("uses engineAdvance SHOWDOWN outcome", () => {
    const players = [makePlayer({ seat: 0 }), makePlayer({ seat: 1 })];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: true,
    }));

    const mocks = runFinish({
      players,
      drawRound: 3,
      engineAdvance,
    });

    expect(engineAdvance).toHaveBeenCalled();
    expect(mocks.setPhase).toHaveBeenCalledWith("SHOWDOWN");
  });

  it("uses engineAdvance DRAW outcome", () => {
    const players = [makePlayer({ seat: 0 }), makePlayer({ seat: 1 })];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: false,
      drawRoundIndex: 1,
      actingPlayerIndex: 0,
    }));

    const mocks = runFinish({
      players,
      engineAdvance,
    });

    expect(mocks.setPhase).toHaveBeenCalledWith("DRAW");
    expect(mocks.setDrawRound).toHaveBeenCalledWith(1);
  });

  it("overrides engine SHOWDOWN with DRAW when a remaining player has draws available", () => {
    const players = [
      makePlayer({ seat: 0 }),
      makePlayer({ seat: 1, folded: true }),
    ];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: true,
      drawRoundIndex: 1,
      actingPlayerIndex: 0,
    }));

    const mocks = runFinish({
      players,
      drawRound: 0,
      MAX_DRAWS: 3,
      engineAdvance,
    });

    expect(engineAdvance).toHaveBeenCalled();
    expect(mocks.setPhase).toHaveBeenCalledWith("DRAW");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("SHOWDOWN");
    expect(mocks.runShowdown).not.toHaveBeenCalled();
  });

  it("resets draw flags before checking earlyShowdown draw eligibility", () => {
    const players = [
      makePlayer({ seat: 0, hasDrawn: true, canDraw: false }),
      makePlayer({ seat: 1, folded: true }),
    ];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: true,
      drawRoundIndex: 1,
      actingPlayerIndex: 0,
    }));

    const mocks = runFinish({
      players,
      drawRound: 0,
      MAX_DRAWS: 3,
      engineAdvance,
    });

    expect(engineAdvance).toHaveBeenCalled();
    expect(mocks.setPhase).toHaveBeenCalledWith("DRAW");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("SHOWDOWN");

    // Current behavior: resetDrawRoundFlags makes the originally non-draw-eligible
    // active player drawable again, so this covers the suspicious branch as-is.
    expect(mocks.setPlayers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ seat: 0, hasDrawn: false, canDraw: true }),
      ]),
    );
  });

  it("invokes draw-skip handling and records SKIP_DRAW_ROUND when no draw seats are actionable", () => {
    const recordActionToLog = vi.fn();

    const mocks = runFinish({
      players: [
        makePlayer({
          seat: 0,
          isActiveInGame: false,
          isBusted: true,
        }),
        makePlayer({ seat: 1, folded: true }),
      ],
      recordActionToLog,
    });

    expect(mocks.setPhase).toHaveBeenCalledWith("BET");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("DRAW");
    expect(recordActionToLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SKIP_DRAW_ROUND",
        round: 1,
        phase: "DRAW",
      }),
    );
  });

  it("falls back to legacy flow when engineAdvance throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const engineAdvance = vi.fn(() => {
      throw new Error("engine fail");
    });

    const mocks = runFinish({
      drawRound: 3,
      engineAdvance,
    });

    expect(engineAdvance).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[ENGINE] advanceAfterBet failed"),
      expect.any(Error),
    );
    expect(mocks.setPots).toHaveBeenCalled();
    expect(mocks.setPhase).toHaveBeenCalledWith("SHOWDOWN");
  });

  it("silently aborts when all players are folded", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const mocks = runFinish({
      players: [
        makePlayer({ seat: 0, folded: true }),
        makePlayer({ seat: 1, folded: true }),
      ],
    });

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("No non-folded players found"),
    );
    expect(mocks.setPhase).not.toHaveBeenCalled();
  });
});

describe("PB-2: earlyShowdown override regression", () => {
  it("all-in player does not trigger earlyShowdown and SHOWDOWN is honored", () => {
    const players = [
      makePlayer({ seat: 0, folded: true }),
      makePlayer({ seat: 1, allIn: true, stack: 0 }),
    ];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: true,
      actingPlayerIndex: 1,
    }));

    const mocks = runFinish({
      players,
      drawRound: 1,
      MAX_DRAWS: 3,
      NUM_PLAYERS: 2,
      dealerIdx: 0,
      engineAdvance,
    });

    expect(mocks.setPhase).toHaveBeenCalledWith("SHOWDOWN");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("DRAW");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("BET");
  });

  it("overrides engine SHOWDOWN with DRAW when sole survivor can still draw", () => {
    const mocks = makeMocks();
    const players = [
      makePlayer({ seat: 0, folded: true }),
      makePlayer({ seat: 1 }),
    ];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: true,
      actingPlayerIndex: 1,
    }));

    finishBetRoundFrom({
      ...BASE,
      ...mocks,
      players,
      pots: [],
      drawRound: 1,
      MAX_DRAWS: 3,
      NUM_PLAYERS: 2,
      dealerIdx: 0,
      engineAdvance,
    });

    expect(mocks.setPhase).toHaveBeenCalledWith("DRAW");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("SHOWDOWN");
  });

  it("honors engine SHOWDOWN when sole non-allIn player is isBusted and cannot draw", () => {
    const mocks = makeMocks();
    const players = [
      makePlayer({ seat: 0, folded: true }),
      makePlayer({ seat: 1, isBusted: true }),
    ];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: true,
    }));

    finishBetRoundFrom({
      ...BASE,
      ...mocks,
      players,
      pots: [],
      drawRound: 0,
      MAX_DRAWS: 3,
      NUM_PLAYERS: 2,
      dealerIdx: 0,
      engineAdvance,
    });

    expect(mocks.setPhase).toHaveBeenCalledWith("SHOWDOWN");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("BET");
    expect(mocks.setPhase).not.toHaveBeenCalledWith("DRAW");
    expect(mocks.setDrawRound).not.toHaveBeenCalled();
  });

  it("reaches SHOWDOWN on each round when engine returns showdown:true and no drawable non-allIn players exist", () => {
    const players = [
      makePlayer({ seat: 0, folded: true }),
      makePlayer({ seat: 1, isBusted: true }),
    ];
    const engineAdvance = vi.fn(() => ({
      state: { players, pots: [] },
      players,
      pots: [],
      showdown: true,
    }));

    for (const drawRound of [0, 1, 2]) {
      const mocks = makeMocks();

      finishBetRoundFrom({
        ...BASE,
        ...mocks,
        players,
        pots: [],
        drawRound,
        MAX_DRAWS: 3,
        NUM_PLAYERS: 2,
        dealerIdx: 0,
        engineAdvance,
      });

      expect(mocks.setPhase).toHaveBeenCalledWith("SHOWDOWN");
    }

    expect(engineAdvance).toHaveBeenCalledTimes(3);
  });
});
