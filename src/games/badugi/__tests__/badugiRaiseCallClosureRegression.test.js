import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";
import {
  buildBadugiActionAuditEntry,
  buildBadugiRoundCloseAudit,
  playersNeedingBadugiBetAction,
} from "../auditBadugiActionOrder.js";

function player(name, betThisRound = 20, overrides = {}) {
  return {
    name,
    stack: 480,
    hand: ["AS", "2H", "3C", "4D"],
    betThisRound,
    totalInvested: betThisRound,
    hasActedThisRound: true,
    folded: false,
    hasFolded: false,
    allIn: false,
    seatOut: false,
    ...overrides,
  };
}

function makeController(snapshot = {}) {
  const controller = new BadugiGameController({
    numSeats: 3,
    blindStructure: [{ sb: 10, bb: 20 }],
    lastStructureIndex: 0,
  });
  const state = controller.syncFromExternalState({
    handIndex: 1,
    snapshot: {
      handId: "badugi-raise-call-closure-test",
      players: [
        player("Hero", 20, { hasActedThisRound: false }),
        player("Mina", 20),
        player("Ren", 20),
      ],
      dealerIdx: 2,
      phase: "BET",
      drawRound: 1,
      currentBet: 20,
      betHead: 2,
      lastAggressorIdx: 2,
      turn: 0,
      nextTurn: 0,
      ...snapshot,
    },
  });
  return { controller, state };
}

function apply(controller, state, seatIndex, payload) {
  const before = controller.getUiSnapshot(state);
  const result = controller.applyAction(state, { seatIndex, payload, betSize: 20 });
  const after = controller.getUiSnapshot(result.state);
  const audit = buildBadugiActionAuditEntry({
    handId: after.handId,
    phase: before.phase,
    drawRound: before.drawRound,
    actorSeat: seatIndex,
    action: String(payload.type).toUpperCase(),
    amount: payload.amount ?? null,
    before,
    after,
  });
  return { before, after, result, audit };
}

describe("Badugi raise/call betting closure regression", () => {
  it("closes the betting round after a raise and all callers match without reselecting the raiser", () => {
    const { controller, state } = makeController();

    const heroRaise = apply(controller, state, 0, { type: "raise" });
    expect(heroRaise.result.events.map((event) => event.type)).not.toContain("betRoundComplete");
    const raisedBet = heroRaise.after.currentBet;
    expect(raisedBet).toBeGreaterThan(20);
    expect(heroRaise.after.players[0].hasActedThisRound).toBe(true);
    expect(heroRaise.after.turn).toBe(1);
    expect(playersNeedingBadugiBetAction(heroRaise.after.players, raisedBet)).toEqual([1, 2]);

    const seatOneCall = apply(controller, heroRaise.result.state, 1, { type: "call" });
    expect(seatOneCall.after.turn).toBe(2);
    expect(playersNeedingBadugiBetAction(seatOneCall.after.players, raisedBet)).toEqual([2]);

    const seatTwoCall = apply(controller, seatOneCall.result.state, 2, { type: "call" });
    const closeAudit = buildBadugiRoundCloseAudit({
      players: seatTwoCall.before.players.map((player, seat) =>
        seat === 2
          ? { ...player, betThisRound: raisedBet, totalInvested: raisedBet, hasActedThisRound: true }
          : player,
      ),
      currentBet: raisedBet,
      actualTransition: seatTwoCall.after.phase,
    });

    expect(seatTwoCall.result.events.map((event) => event.type)).toContain("betRoundComplete");
    expect(closeAudit.shouldClose).toBe(true);
    expect(closeAudit.playersNeedingAction).toEqual([]);
    expect(seatTwoCall.after.phase).toBe("DRAW");
    expect(seatTwoCall.after.currentBet).toBe(0);
    expect(seatTwoCall.after.phase).not.toBe("BET");
    expect(seatTwoCall.after.players[0].hasActedThisRound).toBe(false);
  });

  it("does not reopen hero action when a call completes an existing bet", () => {
    const { controller, state } = makeController({
      players: [
        player("Hero", 40),
        player("Mina", 40),
        player("Ren", 20, { hasActedThisRound: false }),
      ],
      currentBet: 40,
      betHead: 0,
      lastAggressorIdx: 0,
      turn: 2,
      nextTurn: 2,
    });

    const lastCaller = apply(controller, state, 2, { type: "call" });

    expect(lastCaller.result.events.map((event) => event.type)).toContain("betRoundComplete");
    expect(lastCaller.after.phase).toBe("DRAW");
    expect(lastCaller.after.phase).not.toBe("BET");
  });

  it("allows hero to act again only when another player re-raises", () => {
    const { controller, state } = makeController();
    const heroRaise = apply(controller, state, 0, { type: "raise" });
    const seatOneReraise = apply(controller, heroRaise.result.state, 1, {
      type: "raise",
    });

    const reraisedBet = seatOneReraise.after.currentBet;
    expect(reraisedBet).toBeGreaterThan(heroRaise.after.currentBet);
    expect(seatOneReraise.after.players[0].hasActedThisRound).toBe(false);
    expect(playersNeedingBadugiBetAction(seatOneReraise.after.players, reraisedBet)).toEqual([0, 2]);

    const seatTwoCall = apply(controller, seatOneReraise.result.state, 2, { type: "call" });

    expect(seatTwoCall.after.phase).toBe("BET");
    expect(seatTwoCall.after.turn).toBe(0);
    expect(playersNeedingBadugiBetAction(seatTwoCall.after.players, reraisedBet)).toEqual([0]);
  });

  it("does not preserve stale hero turn after normalize/build when hero has matched and acted", () => {
    const { controller, state } = makeController({
      players: [
        player("Hero", 40, { hasActedThisRound: true }),
        player("Mina", 40, { hasActedThisRound: true }),
        player("Ren", 20, { hasActedThisRound: false }),
      ],
      currentBet: 40,
      betHead: 0,
      lastAggressorIdx: 0,
      turn: 0,
      nextTurn: 0,
      metadata: { actingPlayerIndex: 0 },
    });

    const snapshot = controller.getUiSnapshot(state);
    expect(snapshot.turn).toBe(2);
    expect(snapshot.nextTurn).toBe(2);
    expect(snapshot.metadata?.actingPlayerIndex ?? snapshot.actingPlayerIndex).not.toBe(0);
  });

  it("does not grant another betting action after opponents fold to one player", () => {
    const { controller, state } = makeController();
    const heroRaise = apply(controller, state, 0, { type: "raise" });
    const seatOneFold = apply(controller, heroRaise.result.state, 1, { type: "fold" });
    const seatTwoFold = apply(controller, seatOneFold.result.state, 2, { type: "fold" });

    expect(seatTwoFold.after.phase).not.toBe("BET");
    expect(seatTwoFold.after.phase).not.toBe("BET");
  });
});
