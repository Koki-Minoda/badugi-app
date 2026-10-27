import { describe, expect, it } from "vitest";
import PLOGameController from "../PLOGameController.js";
import PLO8GameController from "../PLO8GameController.js";
import FiveCardPLOGameController from "../FiveCardPLOGameController.js";
import BigOGameController from "../BigOGameController.js";

const variants = [
  ["PLO", PLOGameController],
  ["PLO8", PLO8GameController],
  ["Five-card PLO", FiveCardPLOGameController],
  ["Big O", BigOGameController],
];

function start(Controller, actorStack = 1000) {
  const controller = new Controller({ tableConfig: {
    seats: [actorStack, 1000, 1000].map((stack, seatIndex) => ({ name: `Seat ${seatIndex}`, stack })),
    blinds: { sb: 10, bb: 20, ante: 0 },
  } });
  controller.startNewHand();
  return controller;
}

describe.each(variants)("%s pot-limit all-in", (_name, Controller) => {
  it("rejects an all-in above the pot-limit maximum without moving chips", () => {
    const controller = start(Controller);
    const actor = controller.state.currentActor;
    expect(controller.getPotLimitMaxCommit(actor)).toBe(70);
    const before = structuredClone(controller.state);

    expect(controller.applyPlayerAction({ seatIndex: actor, action: "all-in" })).toMatchObject({ success: false });
    expect(controller.state).toEqual(before);
  });

  it("accepts an all-in exactly at the pot-limit maximum", () => {
    const controller = start(Controller, 70);
    const actor = controller.state.currentActor;
    expect(controller.getPotLimitMaxCommit(actor)).toBe(70);

    expect(controller.applyPlayerAction({ seatIndex: actor, action: "all-in" }).success).toBe(true);
    expect(controller.state.players[actor].stack).toBe(0);
    expect(controller.state.currentBet).toBe(70);
  });

  it("preserves a short all-in call", () => {
    const controller = start(Controller, 10);
    const actor = controller.state.currentActor;

    expect(controller.applyPlayerAction({ seatIndex: actor, action: "all-in" }).success).toBe(true);
    expect(controller.state.players[actor].stack).toBe(0);
    expect(controller.state.currentBet).toBe(20);
  });
});
