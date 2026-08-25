import { describe, expect, it } from "vitest";
import { NLHUIAdapter } from "../game/nlh/NLHUIAdapter.js";
import { DrawLowballUIAdapter } from "../game/draw/DrawLowballUIAdapter.js";

describe("variant all-in visibility policy snapshots", () => {
  it("allows board-game all-in reveal only after action is complete", () => {
    const adapter = new NLHUIAdapter();
    const baseSnapshot = {
      variantId: "nlh",
      street: "FLOP",
      currentActor: null,
      currentBet: 40,
      boardCards: ["2C", "7D", "9H"],
      players: [
        { name: "Hero", stack: 960, betThisStreet: 40, holeCards: ["AS", "KS"] },
        {
          name: "CPU",
          stack: 0,
          allIn: true,
          betThisStreet: 40,
          holeCards: ["QD", "JC"],
        },
      ],
    };

    const hidden = adapter.buildViewProps({
      controllerSnapshot: { ...baseSnapshot, allInActionComplete: false },
      tableConfig: { blinds: { sb: 10, bb: 20 } },
    });
    expect(hidden.seatViews[1].showHand).toBe(false);
    expect(hidden.seatViews[1].cards).toEqual(["?", "?"]);

    const revealed = adapter.buildViewProps({
      controllerSnapshot: { ...baseSnapshot, allInActionComplete: true },
      tableConfig: { blinds: { sb: 10, bb: 20 } },
    });
    expect(revealed.seatViews[1].showHand).toBe(true);
    expect(revealed.seatViews[1].cards).toEqual(["QD", "JC"]);
  });

  it("keeps draw-game all-in cards hidden before showdown even after action is complete", () => {
    const adapter = new DrawLowballUIAdapter();
    const view = adapter.buildViewProps({
      controllerSnapshot: {
        variantId: "D02",
        phase: "DRAW",
        allInActionComplete: true,
        turn: 1,
        players: [
          { name: "Hero", stack: 500, hand: ["AS", "2D", "3H", "4C", "5S"] },
          {
            name: "CPU",
            stack: 0,
            allIn: true,
            hand: ["6S", "4D", "3C", "2H", "AC"],
            showHand: true,
          },
        ],
        pots: [{ amount: 80, eligible: [0, 1] }],
      },
      tableConfig: { bbValue: 20 },
    });

    expect(view.seatViews[1].showHand).toBe(false);
  });
});
