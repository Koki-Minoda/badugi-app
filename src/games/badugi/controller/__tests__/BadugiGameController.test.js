import { describe, it, expect } from "vitest";
import { BadugiGameController } from "../BadugiGameController.js";
import { GAME_VARIANTS } from "../../../core/variants.js";

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
});
