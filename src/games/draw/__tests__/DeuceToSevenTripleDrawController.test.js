import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

class FakeDeckManager {
  constructor(cards = []) {
    this.cards = [...cards];
    this.discardPile = [];
  }

  reset() {}

  draw(count = 1) {
    return this.cards.splice(0, count);
  }

  discard(cards = []) {
    this.discardPile.push(...cards);
  }
}

function buildController(cards = []) {
  return new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager(cards),
    }),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    },
  });
}

describe("DeuceToSevenTripleDrawController", () => {
  it("starts a D01 hand and returns a UI-compatible snapshot", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const initial = controller.createInitialState();
    const state = controller.createNewHandState(initial);
    const snapshot = controller.getUiSnapshot(state);

    expect(snapshot.gameId).toBe("deuce_to_seven_triple_draw");
    expect(snapshot.variantId).toBe("D01");
    expect(snapshot.phase).toBe("BET");
    expect(snapshot.drawRound).toBe(0);
    expect(snapshot.players).toHaveLength(2);
    expect(snapshot.players[0].hand).toHaveLength(5);
    expect(snapshot.players[0].cards).toEqual(snapshot.players[0].hand);
    expect(snapshot.players[0].selected).toEqual([]);
    expect(snapshot.maxDiscardCount).toBe(5);
    expect(snapshot.handCardCount).toBe(5);
    expect(snapshot.turn).toBe(0);
    expect(snapshot.currentBet).toBe(20);
  });

  it("preserves current ring-game stacks when starting the next hand", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
      "2C", "3C", "4C", "5C", "9C",
      "2D", "3D", "4D", "5D", "9D",
    ]);
    const initial = controller.createInitialState();
    const state = controller.createNewHandState(initial, {
      currentPlayers: [
        { playerId: "hero", name: "Hero", stack: 650, avatar: "/characters/01.png" },
        { playerId: "villain", name: "Villain", stack: 350, avatar: "/characters/02.png" },
      ],
      structure: { sb: 0, bb: 0, ante: 0 },
    });
    const snapshot = controller.getUiSnapshot(state);

    expect(snapshot.players[0]).toMatchObject({
      playerId: "hero",
      name: "Hero",
      stack: 650,
      avatar: "/characters/01.png",
    });
    expect(snapshot.players[1]).toMatchObject({
      playerId: "villain",
      name: "Villain",
      stack: 350,
      avatar: "/characters/02.png",
    });
  });

  it("exposes legal BET actions for the acting seat", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());

    expect(controller.getLegalActions(state, 1)).toEqual([]);
    expect(controller.getLegalActions(state, 0).map((action) => action.type)).toEqual([
      "FOLD",
      "CALL",
      "RAISE",
    ]);
  });

  it("syncs an external D01 opening snapshot so CPU betting can progress", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
      "2C", "3C", "4C", "5C", "9C",
      "2D", "3D", "4D", "5D", "9D",
      "6S", "7C", "8D", "9H", "TC",
      "6H", "7D", "8C", "9S", "TD",
    ]);
    const initial = controller.createInitialState();
    const synced = controller.syncFromExternalState({
      handIndex: 1,
      snapshot: {
        handId: "d01-hand-1",
        gameId: "deuce_to_seven_triple_draw",
        variantId: "deuce_to_seven_triple_draw",
        phase: "BET",
        street: "BET",
        drawRound: 0,
        drawRoundIndex: 0,
        dealerIdx: 0,
        turn: 3,
        nextTurn: 3,
        actingPlayerIndex: 3,
        currentBet: 20,
        sbSeat: 1,
        bbSeat: 2,
        players: initial.snapshot.players.length
          ? initial.snapshot.players
          : Array.from({ length: 6 }, (_, seat) => ({
              id: `seat-${seat}`,
              playerId: `seat-${seat}`,
              name: seat === 0 ? "You" : `CPU ${seat + 1}`,
              seatType: seat === 0 ? "HUMAN" : "CPU",
              isCPU: seat !== 0,
              stack: seat === 1 ? 490 : seat === 2 ? 480 : 500,
              betThisRound: seat === 1 ? 10 : seat === 2 ? 20 : 0,
              bet: seat === 1 ? 10 : seat === 2 ? 20 : 0,
              hand: ["2S", "3S", "4S", "5S", "7S"],
              folded: false,
              allIn: false,
              seatOut: false,
              hasActedThisRound: false,
              lastAction: seat === 1 ? "SB" : seat === 2 ? "BB" : "",
            })),
      },
    });

    const opening = controller.getUiSnapshot(synced);
    expect(opening.phase).toBe("BET");
    expect(opening.turn).toBe(3);
    expect(controller.getLegalActions(synced, 3).map((action) => action.type)).toEqual([
      "FOLD",
      "CALL",
      "RAISE",
    ]);

    const result = controller.applyAction(synced, {
      seatIndex: 3,
      type: "CALL",
      amount: 20,
    });
    const after = controller.getUiSnapshot(result.state);

    expect(result.events[0]?.type).toBe("actionApplied");
    expect(after.turn).toBe(4);
    expect(after.players[3].lastAction).toBe("Call");
    expect(after.players[3].betThisRound).toBe(20);
  });

  it("exposes legal DRAW action only for the current draw actor", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());
    state = controller.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = controller.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.turn).toBe(1);
    expect(controller.getLegalActions(state, 0)).toEqual([]);
    expect(controller.getLegalActions(state, 1)).toEqual([
      { type: "DRAW", minDiscard: 0, maxDiscard: 5 },
    ]);
  });

  it("exposes DRAW, not betting actions, for an all-in live draw actor", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.street = "DRAW";
    state.engineState.actingPlayerIndex = 1;
    state.engineState.players[1] = {
      ...state.engineState.players[1],
      allIn: true,
      stack: 0,
      folded: false,
      sittingOut: false,
      seatOut: false,
      hasDrawn: false,
      canDraw: true,
    };

    expect(controller.getLegalActions(state, 1)).toEqual([
      { type: "DRAW", minDiscard: 0, maxDiscard: 5 },
    ]);

    state.engineState.street = "BET";
    expect(controller.getLegalActions(state, 1)).toEqual([]);
  });

  it("exposes the D01 rule-based CPU action through the controller", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.actingPlayerIndex = 1;
    state.engineState.players[1].hand = ["7S", "5D", "4C", "3H", "2S"];

    expect(controller.getCpuAction(state, 1)).toMatchObject({
      seatIndex: 1,
      type: "RAISE",
      metadata: { strategy: "ruleBasedD01", raiseReason: "strongPat" },
    });
    expect(controller.getCpuAction(state, 0)).toBeNull();
  });

  it("PRO-ROUTE-001 calls the Pro overlay when tier=pro", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.actingPlayerIndex = 1;
    state.engineState.players[1].hand = ["7S", "5D", "4C", "3H", "2S"];

    const action = controller.getCpuAction(state, 1, {
      tierConfig: { id: "pro" },
    });

    expect(action).toMatchObject({
      seatIndex: 1,
      type: "RAISE",
      metadata: {
        strategy: "pro-d01",
        tierId: "pro",
        decisionSource: "pro-overlay",
      },
    });
  });

  it("PRO-ROUTE-003 keeps standard and Pro controller routes distinguishable", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.actingPlayerIndex = 1;
    state.engineState.players[1].hand = ["7S", "5D", "4C", "3H", "2S"];

    const standardAction = controller.getCpuAction(state, 1);
    const proAction = controller.getCpuAction(state, 1, {
      tierConfig: { id: "pro" },
    });

    expect(standardAction?.metadata?.strategy).toBe("ruleBasedD01");
    expect(proAction?.metadata?.strategy).toBe("pro-d01");
    expect(proAction?.metadata?.decisionSource).toBe("pro-overlay");
  });

  it("applies betting actions and emits a bet-round completion event", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());

    let result = controller.applyAction(state, {
      seatIndex: 0,
      type: "CALL",
    });
    expect(result.events[0]).toMatchObject({ type: "actionApplied", seatIndex: 0 });
    state = result.state;

    result = controller.applyAction(state, {
      seatIndex: 1,
      type: "CHECK",
    });

    expect(result.events[0]).toMatchObject({ type: "betRoundComplete", drawRound: 1 });
    expect(result.state.snapshot.phase).toBe("DRAW");
    expect(result.state.snapshot.drawRound).toBe(1);
    expect(result.state.snapshot.pot).toBe(40);
  });

  it("normalizes drawIndexes into discardIndexes and returns to BET after all draw", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
      "9S", "10S",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());
    state = controller.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = controller.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    let result = controller.applyAction(state, {
      seatIndex: 1,
      payload: { type: "DRAW", drawIndexes: [3, 4] },
    });
    expect(result.events[0]).toMatchObject({ type: "drawAction", seatIndex: 1, drawCount: 2 });
    expect(result.state.snapshot.players[1].lastAction).toBe("DRAW(2)");
    expect(result.state.snapshot.phase).toBe("DRAW");

    result = controller.applyAction(result.state, {
      seatIndex: 0,
      payload: { type: "DRAW", drawIndexes: [] },
    });
    expect(result.events[0]).toMatchObject({ type: "drawRoundComplete", drawRound: 1 });
    expect(result.state.snapshot.phase).toBe("BET");
    expect(result.state.snapshot.players[0].lastAction).toBe("Pat");
  });

  it("returns invalidAction events without mutating state for bad controller input", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());

    const missingSeat = controller.applyAction(state, { type: "CALL" });
    expect(missingSeat.events[0]).toMatchObject({
      type: "invalidAction",
      error: "seatIndex is required",
    });
    expect(missingSeat.state).toBe(state);

    const outOfTurn = controller.applyAction(state, { seatIndex: 1, type: "CALL" });
    expect(outOfTurn.events[0]).toMatchObject({
      type: "invalidAction",
    });
    expect(outOfTurn.events[0].error).toMatch(/out of turn/);
    expect(outOfTurn.state).toBe(state);
  });

  it("returns overlay-ready 2-7 hand labels in lastHandResult", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.players[0].hand = ["7S", "5D", "4C", "3H", "2S"];
    state.engineState.players[1].hand = ["8S", "5H", "4D", "3C", "2D"];
    state.engineState.players[0].bet = 0;
    state.engineState.players[1].bet = 0;
    state.engineState.players[0].totalInvested = 0;
    state.engineState.players[1].totalInvested = 0;
    state.engineState.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const showdown = controller.engine.resolveShowdown(state.engineState).state;
    const snapshot = controller.getUiSnapshot(showdown);

    expect(snapshot.lastHandResult.pot).toBe(100);
    expect(snapshot.lastHandResult.potDetails[0].winners[0]).toMatchObject({
      seatIndex: 0,
      payout: 100,
      handLabel: "2-7 Low 7-5-4-3-2",
    });
    expect(snapshot.lastHandResult.winners[0].handLabel).toBe("2-7 Low 7-5-4-3-2");
  });

  it("emits handComplete and exposes winners after a fold win", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());

    const result = controller.applyAction(state, {
      seatIndex: 0,
      type: "FOLD",
    });

    expect(result.events[0]).toMatchObject({
      type: "handComplete",
      totalPot: 30,
    });
    expect(result.state.snapshot.phase).toBe("SHOWDOWN");
    expect(controller.isHandFinished(result.state)).toBe(true);
    expect(controller.getWinners(result.state)).toEqual([
      expect.objectContaining({
        seatIndex: 1,
        payout: 30,
      }),
    ]);
  });
});
