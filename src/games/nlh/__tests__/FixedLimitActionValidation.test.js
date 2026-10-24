import { describe, expect, it } from "vitest";
import { FLHGameController } from "../FLHGameController.js";
import { FLSuperHoldemGameController } from "../SuperHoldemGameController.js";
import { FLO8GameController } from "../../plo/FLO8GameController.js";

describe.each([
  ["FL Hold'em", FLHGameController],
  ["FL Super Hold'em", FLSuperHoldemGameController],
  ["FLO8", FLO8GameController],
])("%s fixed-limit action validation", (_name, Controller) => {
  function start() {
    const controller = new Controller({ tableConfig: {
      seats: ["Hero", "CPU 1", "CPU 2"].map(name => ({ name, stack: 1000 })),
      blinds: { sb: 10, bb: 20, ante: 0 },
    } });
    controller.startNewHand();
    return controller;
  }

  it("uses exactly one fixed unit even when the caller supplies an oversized raise", () => {
    const controller = start();
    const actor = controller.state.currentActor;
    const beforeBet = controller.state.currentBet;
    const beforeStack = controller.state.players[actor].stack;
    const toCall = beforeBet - controller.state.players[actor].betThisStreet;
    const unit = controller.getLimitUnit();
    const result = controller.applyPlayerAction({ seatIndex: actor, action: "raise", amount: 400 });
    expect(result.success).toBe(true);
    expect(controller.state.currentBet).toBe(beforeBet + unit);
    expect(controller.state.players[actor].stack).toBe(beforeStack - toCall - unit);
    expect(controller.raiseCountThisStreet).toBe(1);
  });

  it("does not consume the raise cap when rejecting an out-of-turn raise", () => {
    const controller = start();
    const before = structuredClone(controller.state);
    const result = controller.applyPlayerAction({
      seatIndex: (controller.state.currentActor + 1) % 3, action: "raise",
    });
    expect(result.success).toBe(false);
    expect(controller.raiseCountThisStreet).toBe(0);
    expect(controller.state).toEqual(before);
  });

  it("does not consume the raise cap when rejecting a bet after betting opened", () => {
    const controller = start();
    const before = structuredClone(controller.state);
    const result = controller.applyPlayerAction({ seatIndex: controller.state.currentActor, action: "bet" });
    expect(result.success).toBe(false);
    expect(controller.raiseCountThisStreet).toBe(0);
    expect(controller.state).toEqual(before);
  });
});
