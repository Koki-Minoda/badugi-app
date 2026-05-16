import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";

const blindStructure = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];

const seat = (overrides = {}) => ({
  name: overrides.name ?? "Seat",
  stack: overrides.stack ?? 480,
  hand: overrides.hand ?? ["AS", "2H", "3C", "4D"],
  betThisRound: overrides.betThisRound ?? 0,
  bet: overrides.bet ?? overrides.betThisRound ?? 0,
  totalInvested: overrides.totalInvested ?? 20,
  hasActedThisRound: overrides.hasActedThisRound ?? false,
  lastAction: overrides.lastAction ?? "",
  folded: overrides.folded ?? false,
  hasFolded: overrides.hasFolded ?? overrides.folded ?? false,
  seatOut: overrides.seatOut ?? false,
  allIn: overrides.allIn ?? false,
});

describe("Badugi no-next-alive regression", () => {
  it("advances from checked post-draw betting instead of re-electing checked hero", () => {
    const controller = new BadugiGameController({
      numSeats: 6,
      blindStructure,
      lastStructureIndex: 0,
    });
    const players = [
      seat({ name: "Hero", hasActedThisRound: false, lastAction: "" }),
      seat({ name: "Mina", hasActedThisRound: true, lastAction: "Check" }),
      seat({ name: "Ren", hasActedThisRound: true, lastAction: "Check" }),
      seat({ name: "Sora", hasActedThisRound: true, lastAction: "Check" }),
      seat({ name: "Hana", folded: true, hasActedThisRound: true, lastAction: "Fold" }),
      seat({ name: "Jun", folded: true, hasActedThisRound: true, lastAction: "Fold" }),
    ];

    const state = controller.syncFromExternalState({
      snapshot: {
        phase: "BET",
        drawRound: 1,
        dealerIdx: 0,
        currentBet: 0,
        betHead: null,
        lastAggressorIdx: null,
        turn: 0,
        nextTurn: 0,
        players,
      },
      handIndex: 1,
    });

    const result = controller.applyAction(state, {
      seatIndex: 0,
      payload: { type: "check" },
    });

    expect(result.events.some((event) => event.type === "invalidAction")).toBe(false);
    expect(result.events.some((event) => event.type === "betRoundComplete")).toBe(true);
    expect(result.state.snapshot.phase).toBe("DRAW");
    expect(result.state.snapshot.nextTurn).not.toBe(0);
  });
});
