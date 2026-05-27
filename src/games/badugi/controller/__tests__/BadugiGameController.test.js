import { afterEach, describe, it, expect, vi } from "vitest";
import { BadugiGameController } from "../BadugiGameController.js";
import { GAME_VARIANTS } from "../../../core/variants.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../../../core/draw/normalizeDrawAction.js");
});

function createController(config = {}) {
  const factory = GAME_VARIANTS.badugi.controllerFactory;
  /** @type {BadugiGameController} */
  const controller = factory({
    seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    startingStack: 500,
    blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
    ...config,
  });
  return controller;
}

function createSixMaxController(config = {}) {
  const factory = GAME_VARIANTS.badugi.controllerFactory;
  return factory({
    seatConfig: ["HERO", "CPU", "CPU", "CPU", "CPU", "CPU"],
    startingStack: 500,
    blindStructure: [{ sb: 10, bb: 20, ante: 0 }],
    ...config,
  });
}

function ensureDrawPhase(controller, state, seatIndex = 0) {
  const snapshot = controller.getUiSnapshot(state);
  const drawSnapshot = {
    ...snapshot,
    phase: "DRAW",
    drawRound: snapshot.drawRound ?? 0,
    betRoundIndex: snapshot.betRoundIndex ?? 0,
    nextTurn: seatIndex,
    turn: seatIndex,
    players: (snapshot.players ?? []).map((player) => ({
      ...player,
      hasDrawn: false,
      folded: false,
      seatOut: false,
    })),
  };
  return controller.syncFromExternalState({
    snapshot: drawSnapshot,
    context: state?.context ?? null,
    handIndex: state?.handIndex ?? 0,
  });
}

describe("BadugiGameController – new hand", () => {
  it("creates a new hand with players, stacks, and blinds", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snap = controller.getUiSnapshot(state);

    expect(Array.isArray(snap.players)).toBe(true);
    expect(snap.players.length).toBe(4);

    const hero = snap.players[0];
    const sb = snap.players[1];
    const bb = snap.players[2];

    expect(hero.stack).toBeGreaterThan(0);
    expect(sb.stack).toBeLessThan(500);
    expect(bb.stack).toBeLessThan(500);

    expect(snap.phase).toBe("BET");
    expect(typeof (snap.turn ?? snap.nextTurn)).toBe("number");
    expect(typeof (snap.dealerSeat ?? snap.dealerIdx)).toBe("number");
  });
});

describe("BadugiGameController – betting", () => {
  it("handles a fold and advances turn", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapBefore = controller.getUiSnapshot(state);
    const actingSeat = snapBefore.turn ?? snapBefore.nextTurn ?? 0;

    const { state: nextState, events } = controller.applyAction(state, {
      seatIndex: actingSeat,
      payload: { type: "fold" },
    });

    const snapAfter = controller.getUiSnapshot(nextState);
    const foldedPlayer = snapAfter.players[actingSeat];
    const nextTurn = snapAfter.turn ?? snapAfter.nextTurn;

    expect(foldedPlayer.folded || foldedPlayer.hasFolded).toBe(true);
    expect(nextTurn).not.toBe(actingSeat);
    expect(Array.isArray(events)).toBe(true);
  });

  it("handles a call action without corrupting stack/phase", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapBefore = controller.getUiSnapshot(state);
    const actingSeat = snapBefore.turn ?? snapBefore.nextTurn ?? 0;
    const stackBefore = snapBefore.players[actingSeat]?.stack ?? 0;

    const { state: nextState } = controller.applyAction(state, {
      seatIndex: actingSeat,
      payload: { type: "call" },
    });

    const snapAfter = controller.getUiSnapshot(nextState);
    const player = snapAfter.players[actingSeat];

    expect(player.stack).toBeLessThanOrEqual(stackBefore);
    expect(snapAfter.phase).toBeDefined();
    expect(typeof (snapAfter.turn ?? snapAfter.nextTurn)).toBe("number");
  });

  it("keeps pre-draw BB action open after call-around and closes only after BB acts", () => {
    const controller = createSixMaxController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU", "CPU", "CPU"],
    });
    let state = controller.createNewHandState(initial, {});
    let snapshot = controller.getUiSnapshot(state);
    const bbSeat = snapshot.players.findIndex((player) => (player?.betThisRound ?? 0) === 20);
    expect(bbSeat).toBeGreaterThanOrEqual(0);

    let steps = 0;
    while ((snapshot.turn ?? snapshot.nextTurn) !== bbSeat && steps < 10) {
      const actingSeat = snapshot.turn ?? snapshot.nextTurn;
      const actor = snapshot.players[actingSeat];
      const maxBet = Math.max(...snapshot.players.map((player) => player?.betThisRound ?? 0));
      const toCall = Math.max(0, maxBet - (actor?.betThisRound ?? 0));
      const { state: nextState, events } = controller.applyAction(state, {
        seatIndex: actingSeat,
        payload: { type: toCall === 0 ? "check" : "call", amount: toCall },
      });
      expect(events.some((event) => event.type === "betRoundComplete")).toBe(false);
      state = nextState;
      snapshot = controller.getUiSnapshot(state);
      steps += 1;
    }

    const turnOnClose = snapshot.turn ?? snapshot.nextTurn;
    expect(turnOnClose).toBe(bbSeat);

    const bbPlayer = snapshot.players[bbSeat];
    const maxBet = Math.max(...snapshot.players.map((player) => player?.betThisRound ?? 0));
    const bbToCall = Math.max(0, maxBet - (bbPlayer?.betThisRound ?? 0));
    const { events: bbEvents } = controller.applyAction(state, {
      seatIndex: bbSeat,
      payload: { type: bbToCall === 0 ? "check" : "call", amount: bbToCall },
    });
    expect(bbEvents.some((event) => event.type === "betRoundComplete")).toBe(true);
  });

  it("returns invalidAction with FL_RAISE_CAP when raise cap is reached", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const seeded = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        raiseCap: 0,
        raiseCountThisRound: 0,
        metadata: {
          ...(snapshot.metadata ?? {}),
          raiseCap: 0,
          raiseCountThisRound: 0,
        },
      },
      context: state?.context ?? null,
      handIndex: state?.handIndex ?? 0,
    });
    const seededSnapshot = controller.getUiSnapshot(seeded);
    const actingSeat = seededSnapshot.turn ?? seededSnapshot.nextTurn ?? 0;

    const { events } = controller.applyAction(seeded, {
      seatIndex: actingSeat,
      payload: { type: "raise", amount: 10 },
    });
    const invalid = events.find((event) => event.type === "invalidAction");
    expect(invalid).toBeTruthy();
    expect(invalid?.code).toBe("FL_RAISE_CAP");
  });

  it("does not expose Raise when the normal four-raise cap is reached", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const seeded = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        turn: 0,
        nextTurn: 0,
        raiseCap: 4,
        raiseCountThisRound: 4,
        metadata: {
          ...(snapshot.metadata ?? {}),
          raiseCap: 4,
          raiseCountThisRound: 4,
        },
      },
      context: state?.context ?? null,
      handIndex: state?.handIndex ?? 0,
    });

    expect(controller.getLegalActions(seeded, 0).map((action) => action.type)).not.toContain(
      "RAISE",
    );
    const { events } = controller.applyAction(seeded, {
      seatIndex: 0,
      payload: { type: "raise", amount: 10 },
    });
    expect(events.find((event) => event.type === "invalidAction")?.code).toBe("FL_RAISE_CAP");
  });

  it("does not expose Raise when every opponent is all-in or out", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const seeded = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        phase: "BET",
        turn: 0,
        nextTurn: 0,
        currentBet: 10,
        players: snapshot.players.map((player, seatIndex) => ({
          ...player,
          betThisRound: 10,
          folded: false,
          hasFolded: false,
          seatOut: false,
          isBusted: false,
          allIn: seatIndex !== 0,
          stack: seatIndex === 0 ? 490 : 0,
        })),
      },
      context: state?.context ?? null,
      handIndex: state?.handIndex ?? 0,
    });

    expect(controller.getLegalActions(seeded, 0).map((action) => action.type)).toEqual([
      "FOLD",
      "CHECK",
    ]);
  });

  it("keeps Raise available when one active opponent can still respond", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const seeded = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        phase: "BET",
        turn: 0,
        nextTurn: 0,
        currentBet: 10,
        players: snapshot.players.map((player, seatIndex) => ({
          ...player,
          betThisRound: 10,
          folded: false,
          hasFolded: false,
          seatOut: false,
          isBusted: false,
          allIn: seatIndex > 1,
          stack: seatIndex === 0 ? 490 : seatIndex === 1 ? 490 : 0,
        })),
      },
      context: state?.context ?? null,
      handIndex: state?.handIndex ?? 0,
    });

    expect(controller.getLegalActions(seeded, 0).map((action) => action.type)).toContain("RAISE");
  });

  it("uses reference snapshot street context for advanceStreet when legacy state is stale", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const referenceState = {
      ...state,
      snapshot: {
        ...snapshot,
        dealerIdx: 2,
        drawRound: 2,
        betHead: 1,
        lastAggressorIdx: 3,
        players: (snapshot.players ?? []).map((player) => ({
          ...player,
          folded: false,
          seatOut: false,
          allIn: false,
          betThisRound: 20,
          hasActedThisRound: true,
        })),
      },
    };

    controller.legacy.state.dealerIdx = 0;
    controller.legacy.state.drawRound = 0;
    controller.legacy.state.betHead = null;
    controller.legacy.state.lastAggressorIdx = null;

    vi.spyOn(controller.legacy, "applyPlayerAction").mockReturnValue({ success: true });
    const advanceStreet = vi
      .spyOn(controller.legacy, "advanceStreet")
      .mockReturnValue({ shouldAdvance: false });

    controller.applyAction(referenceState, {
      seatIndex: 0,
      payload: { type: "call" },
    });

    expect(advanceStreet).toHaveBeenCalledWith(
      expect.objectContaining({
        dealerIdx: 2,
        drawRound: 2,
        betHead: 1,
        lastAggressorIdx: 3,
      }),
    );
  });
});

describe("BadugiGameController – syncFromSnapshot null turn handling", () => {
  it("preserves null turn when all turn sources are absent (RISK-04 regression)", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});

    // Simulate the post-bust/terminal state that BadugiEngine.applyForcedBets
    // can produce: legacy state has null turns (e.g. heads-up seatOut scenario).
    controller.legacy.state.turn = null;
    controller.legacy.state.nextTurn = null;

    const snap = controller.getUiSnapshot(state);
    const synced = controller.syncFromExternalState({
      snapshot: {
        ...snap,
        turn: undefined,     // not a number → falls through to legacy state
        nextTurn: undefined, // not a number → falls through to legacy state
      },
      context: state?.context ?? null,
      handIndex: state?.handIndex ?? 0,
    });

    // With the fix: null ?? null ?? null → null, not coerced to 0.
    // syncExternalState does a plain object spread so legacy.state.turn
    // directly reflects the nextTurn value computed at line 614.
    // normalizeTurnState post-processes the *snapshot* but does not
    // write back to legacy.state, so this is the correct observation point.
    expect(controller.legacy.state.turn).toBeNull();
    expect(controller.legacy.state.nextTurn).toBeNull();
  });
});

describe("BadugiGameController – draw", () => {
  it("marks players as having drawn with correct count", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    let state = controller.createNewHandState(initial, {});
    state = ensureDrawPhase(controller, state, 0);

    const snapBefore = controller.getUiSnapshot(state);
    const heroSeat = 0;
    const heroHand = snapBefore.players[heroSeat]?.hand ?? [];
    const drawCount = Math.min(2, heroHand.length);
    const drawIndexes = heroHand.map((_, idx) => idx).slice(0, drawCount);

    const { state: nextState, events } = controller.applyAction(state, {
      seatIndex: heroSeat,
      payload: {
        type: "draw",
        drawCount,
        drawIndexes,
        handAfter: [...heroHand],
      },
    });

    const snapAfter = controller.getUiSnapshot(nextState);
    const heroAfter = snapAfter.players[heroSeat];

    expect(heroAfter.hasDrawn).toBe(true);
    expect(heroAfter.lastDrawCount).toBe(drawCount);
    expect(Array.isArray(events)).toBe(true);
  });

  it("auto-completes the post-draw BET round when all opponents are all-in", () => {
    const controller = createController();
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const players = snapshot.players.map((player, seatIndex) => ({
      ...player,
      stack: seatIndex === 0 ? 480 : 0,
      folded: false,
      hasFolded: false,
      seatOut: false,
      isBusted: false,
      allIn: seatIndex !== 0,
      betThisRound: 0,
      hasActedThisRound: false,
      hasDrawn: true,
    }));

    controller.legacy.state.players = players;
    controller.legacy.state.phase = "DRAW";
    controller.legacy.state.drawRound = 1;
    controller.legacy.state.dealerIdx = 0;

    controller._finishDrawRound(players, 0);

    expect(controller.legacy.state.phase).toBe("DRAW");
    expect(controller.legacy.state.turn).not.toBe(0);
    expect(controller.legacy.state.currentBet).toBe(0);
  });

  it("uses reference snapshot draw round for draw normalization when legacy state is stale", async () => {
    let capturedNormalizeArgs = null;
    vi.resetModules();
    vi.doMock("../../../core/draw/normalizeDrawAction.js", async () => {
      const actual = await vi.importActual("../../../core/draw/normalizeDrawAction.js");
      return {
        ...actual,
        normalizeDrawAction: vi.fn((args) => {
          capturedNormalizeArgs = args;
          return actual.normalizeDrawAction(args);
        }),
      };
    });
    const { BadugiGameController: IsolatedBadugiGameController } = await import(
      "../BadugiGameController.js"
    );
    const controller = new IsolatedBadugiGameController({
      numSeats: 4,
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
      startingStack: 500,
      blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
    });
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {});
    const snapshot = controller.getUiSnapshot(state);
    const referenceState = {
      ...state,
      snapshot: {
        ...snapshot,
        phase: "DRAW",
        dealerIdx: 1,
        drawRound: 2,
        drawRoundIndex: 2,
        turn: 0,
        nextTurn: 0,
        players: (snapshot.players ?? []).map((player) => ({
          ...player,
          hand:
            Array.isArray(player.hand) && player.hand.length === 4
              ? [...player.hand]
              : ["AS", "2C", "3D", "4H"],
          hasDrawn: false,
          hasActedThisRound: false,
          folded: false,
          seatOut: false,
          isBusted: false,
          allIn: false,
          isActiveInGame: true,
        })),
      },
    };
    controller.legacy.state.drawRound = 0;
    controller.legacy.state.dealerIdx = 0;

    const heroHand = referenceState.snapshot.players[0].hand;
    controller.applyAction(referenceState, {
      seatIndex: 0,
      payload: {
        type: "draw",
        drawCount: 0,
        drawIndexes: [],
        handAfter: [...heroHand],
      },
    });

    expect(capturedNormalizeArgs?.state?.drawRoundIndex).toBe(2);
  });
});
