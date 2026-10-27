import { describe, expect, it } from "vitest";
import NLHGameController from "../../games/nlh/NLHGameController.js";
import FLHGameController from "../../games/nlh/FLHGameController.js";
import PLOGameController from "../../games/plo/PLOGameController.js";
import PLO8GameController from "../../games/plo/PLO8GameController.js";
import { StudGameController, Stud8GameController, RazzGameController } from "../../games/stud/StudGameController.js";
import { buildTenGameLiveBettingContext } from "../tenGameLiveBettingContext.js";

const variants = [
  ["B01", NLHGameController], ["B02", FLHGameController],
  ["B05", PLOGameController], ["B06", PLO8GameController],
  ["ST1", StudGameController], ["ST2", Stud8GameController], ["ST3", RazzGameController],
];

function start(Controller, isStud, seatCount = 3) {
  const controller = new Controller({ tableConfig: {
    seats: Array.from({ length: seatCount }, (_, seatIndex) => ({ name: `Seat ${seatIndex}`, stack: 1000 })),
    blinds: { sb: isStud ? 5 : 10, bb: isStud ? 10 : 20, ante: 0 },
  } });
  controller.startNewHand();
  return controller;
}

describe.each(variants)("%s live F03 betting context", (variantId, Controller) => {
  it("derives public betting facts from a real first-street controller state without fabricating model inputs", () => {
    const isStud = variantId.startsWith("ST");
    const controller = start(Controller, isStud);
    const before = structuredClone(controller.state);
    const context = buildTenGameLiveBettingContext({ variantId, controller });

    expect(context.observation).toMatchObject({
      variantId,
      seatIndex: before.currentActor,
      street: isStud ? "THIRD" : "PREFLOP",
      toCall: isStud ? 5 : 20,
      potSize: isStud ? 5 : 30,
      chipUnit: 1000,
      activeOpponents: 2,
      streetProgress: 0,
    });
    expect(context.observation.stackRatio).toBeGreaterThan(0);
    expect(context.observation.stackRatio).toBeLessThanOrEqual(1);
    expect(context.readyForModel).toBe(false);
    expect(context.missingModelInputs).toContain("strength");
    expect(context.missingModelInputs).toContain("drawPotential");
    expect(context.observation).not.toHaveProperty("equity");
    expect(controller.state).toEqual(before);
  });

  it("keeps chip normalization and street progress stable through a real passive hand", () => {
    const isStud = variantId.startsWith("ST");
    const controller = start(Controller, isStud);
    const visited = new Set();
    for (let turn = 0; turn < 40 && controller.state.street !== "SHOWDOWN"; turn += 1) {
      const context = buildTenGameLiveBettingContext({ variantId, controller });
      expect(context).not.toBeNull();
      visited.add(context.observation.street);
      expect(context.observation.chipUnit).toBe(1000);
      expect(context.observation.streetProgress).toBeGreaterThanOrEqual(0);
      expect(context.observation.streetProgress).toBeLessThanOrEqual(1);
      if (variantId === "B02" && context.observation.street === "TURN") {
        expect(context.observation.betSize).toBe(40);
      }
      if (isStud && context.observation.street === "FIFTH") {
        expect(context.observation.betSize).toBe(20);
      }
      const action = context.observation.toCall > 0 ? "call" : "check";
      expect(controller.applyPlayerAction({ seatIndex: controller.state.currentActor, action }).success).toBe(true);
    }
    expect([...visited]).toEqual(isStud
      ? ["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH"]
      : ["PREFLOP", "FLOP", "TURN", "RIVER"]);
  });
});

it("maps all six live board positions into the trainer's exact position buckets", () => {
  const positionMidpoints = { UTG: 0.07, MP: 0.23, CO: 0.42, BTN: 0.63, SB: 0.81, BB: 0.94 };
  for (const [variantId, Controller] of variants.filter(([id]) => id.startsWith("B"))) {
    const controller = start(Controller, false, 6);
    const visited = [];
    while (controller.state.street === "PREFLOP") {
      const context = buildTenGameLiveBettingContext({ variantId, controller });
      const label = context.observation.positionLabel;
      visited.push(label);
      expect(context.observation.position).toBe(positionMidpoints[label]);
      expect(context.missingModelInputs).not.toContain("position");
      const actor = controller.state.currentActor;
      const action = context.observation.toCall > 0 ? "call" : "check";
      expect(controller.applyPlayerAction({ seatIndex: actor, action }).success).toBe(true);
    }
    expect(visited).toEqual(["UTG", "MP", "CO", "BTN", "SB", "BB"]);
  }
});

it("leaves numeric board position missing if a controller returns an unknown label", () => {
  const controller = start(NLHGameController, false);
  controller.getPositionLabel = () => "UNKNOWN";
  const context = buildTenGameLiveBettingContext({ variantId: "B01", controller });
  expect(context.observation.position).toBeUndefined();
  expect(context.missingModelInputs).toContain("position");
  expect(context.readyForModel).toBe(false);
});

it("uses each board controller's full-raise unit, pot maximum, and all-in limit", () => {
  for (const [variantId, Controller, maximumCommit] of [
    ["B01", NLHGameController, 1000],
    ["B02", FLHGameController, 40],
    ["B05", PLOGameController, 70],
    ["B06", PLO8GameController, 70],
  ]) {
    const controller = start(Controller, false);
    const context = buildTenGameLiveBettingContext({ variantId, controller });
    expect(context.legalActions).toEqual(["fold", "call", "raise", ...(variantId === "B01" ? ["all-in"] : [])]);
    expect(context.amountBounds).toMatchObject({
      callCommit: 20,
      aggressiveAction: "raise",
      minimumFullCommit: 40,
      maximumCommit,
    });
    const actor = controller.state.currentActor;
    expect(controller.applyPlayerAction({ seatIndex: actor, action: "raise", amount: maximumCommit }).success).toBe(true);
    expect(controller.state.players[actor].betThisStreet).toBe(maximumCommit);
  }
});

it("removes raises after a fixed-limit cap or an unreopened no-limit short raise", () => {
  const fixed = start(FLHGameController, false);
  fixed.raiseCountThisStreet = fixed.raiseCap;
  expect(buildTenGameLiveBettingContext({ variantId: "B02", controller: fixed }).legalActions)
    .toEqual(["fold", "call"]);

  const noLimit = start(NLHGameController, false);
  noLimit.state.raiseRestrictedSeatIndexes = [noLimit.state.currentActor];
  expect(buildTenGameLiveBettingContext({ variantId: "B01", controller: noLimit }).legalActions)
    .toEqual(["fold", "call"]);
  noLimit.state.players[noLimit.state.currentActor].stack = 10;
  expect(buildTenGameLiveBettingContext({ variantId: "B01", controller: noLimit }).legalActions)
    .toEqual(["fold", "call", "all-in"]);
});

it("keeps Stud legal actions unresolved until the controller rejects illegal actions", () => {
  const controller = start(StudGameController, true);
  const context = buildTenGameLiveBettingContext({ variantId: "ST1", controller });
  expect(context.observation).toMatchObject({ betSize: 10, raiseCount: 0 });
  expect(context.legalActions).toBeNull();
  expect(context.amountBounds).toBeNull();
  expect(context.missingModelInputs).toContain("legalActions");
});

it("does not expose a context for an out-of-turn actor or a terminal hand", () => {
  const controller = start(NLHGameController, false);
  expect(buildTenGameLiveBettingContext({ variantId: "B01", controller, seatIndex: 1 })).toBeNull();
  controller.state.street = "SHOWDOWN";
  expect(buildTenGameLiveBettingContext({ variantId: "B01", controller })).toBeNull();
});

it("fails closed when synchronized chip fields are incomplete", () => {
  const controller = start(NLHGameController, false);
  controller.state.players[controller.state.currentActor].totalInvested = undefined;
  expect(buildTenGameLiveBettingContext({ variantId: "B01", controller })).toBeNull();
});
