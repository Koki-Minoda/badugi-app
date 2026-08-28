import { describe, expect, it } from "vitest";
import { GAME_VARIANTS } from "../../config/variantCatalog.js";
import { NLHGameController } from "../../nlh/NLHGameController.js";
import { FLHGameController } from "../../nlh/FLHGameController.js";
import { FLSuperHoldemGameController, SuperHoldemGameController } from "../../nlh/SuperHoldemGameController.js";
import { BigOGameController } from "../../plo/BigOGameController.js";
import { FiveCardPLOGameController } from "../../plo/FiveCardPLOGameController.js";
import { PLOGameController } from "../../plo/PLOGameController.js";
import { PLO8GameController } from "../../plo/PLO8GameController.js";
import { FLO8GameController } from "../../plo/FLO8GameController.js";
import {
  Razz27GameController,
  RazzduceyGameController,
  RazzdugiGameController,
  RazzGameController,
  Stud8GameController,
  StudGameController,
} from "../../stud/StudGameController.js";
import { createDeterministicRng } from "../deterministicRng.js";
import {
  STRICT_SETTLEMENT_ALLOWLIST,
  getStrictSettlementPolicy,
  validateStrictVariantSettlement,
} from "./strictVariantSettlementGate.js";
import { runProgressScenario } from "../scenario/runProgressScenario.js";

function seats() {
  return Array.from({ length: 6 }, (_, seatIndex) => ({
    seatIndex,
    playerId: `p${seatIndex}`,
    name: `P${seatIndex}`,
    stack: 500,
  }));
}

function playPassiveHand(controller) {
  const beforeState = controller.startNewHand();
  for (let step = 0; step < 100; step += 1) {
    const snapshot = controller.getSnapshot();
    if (snapshot.street === "SHOWDOWN") {
      return { beforeState, afterState: snapshot };
    }
    const actor = snapshot.currentActor;
    const player = snapshot.players[actor];
    const toCall = Math.max(0, snapshot.currentBet - (player.betThisStreet ?? 0));
    const action = toCall > 0 ? "call" : "check";
    const outcome = controller.applyPlayerAction({ seatIndex: actor, action });
    expect(outcome.success).toBe(true);
  }
  throw new Error("NLH passive hand did not terminate");
}

describe("strict per-variant settlement gate", () => {
  it("classifies every non-pilot catalog variant with a documented reason", () => {
    const policies = GAME_VARIANTS.map((variant) => getStrictSettlementPolicy(variant.id));
    expect(policies.filter((policy) => policy.status === "ENFORCED").map((policy) => policy.variantId)).toEqual([
      "B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09",
      "D01", "D02", "D03", "D04", "D05", "D06", "D07",
      "S01", "S02", "S03", "S04", "S05", "S06", "S07",
      "ST1", "ST2", "ST3", "ST4", "ST5", "ST6",
    ]);
    expect(policies.filter((policy) => policy.status === "UNCLASSIFIED")).toEqual([]);
    expect(Object.keys(STRICT_SETTLEMENT_ALLOWLIST)).toHaveLength(7);
    policies.filter((policy) => policy.status === "ALLOWLISTED").forEach((policy) => {
      expect(policy.reason).toEqual(expect.any(String));
      expect(policy.reason.length).toBeGreaterThan(30);
    });
  });

  it.each([
    "D01", "D02", "D03", "D04", "D05", "D06", "D07",
    "S01", "S02", "S03", "S04", "S05", "S06", "S07",
  ])("enforces evaluator-backed draw settlement for ten seeded %s hands", (variantId) => {
    const result = runProgressScenario({
      variantId,
      scenarioId: "cash-10-hands-smoke",
      seed: `strict-draw-${variantId}`,
      maxSteps: 260,
    });
    expect(result.status).toBe("passed");
    expect(result.strictSettlements).toHaveLength(10);
    expect(result.strictSettlements.every((entry) => entry.status === "ENFORCED" && entry.ok)).toBe(true);
  });

  it("passes strict result, pot, evaluator, and chip conservation for seeded NLH", () => {
    const controller = new NLHGameController({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 0 } },
      rng: createDeterministicRng("strict-nlh-pilot"),
    });
    const hand = playPassiveHand(controller);
    const gate = validateStrictVariantSettlement({ variantId: "B01", ...hand });
    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
  });

  it("rejects a tampered NLH payout even when totals still add up", () => {
    const controller = new NLHGameController({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 0 } },
      rng: createDeterministicRng("strict-nlh-tamper"),
    });
    const hand = playPassiveHand(controller);
    const result = structuredClone(hand.afterState.lastHandResult);
    const actualWinner = result.winners[0].seatIndex;
    const wrongWinner = (actualWinner + 1) % seats().length;
    result.winners = result.winners.map((winner) => ({ ...winner, seatIndex: wrongWinner }));
    result.potDetails = result.potDetails.map((pot) => ({
      ...pot,
      winners: pot.winners.map((winner) => ({ ...winner, seatIndex: wrongWinner })),
      winnerSeatIndexes: [wrongWinner],
    }));
    const gate = validateStrictVariantSettlement({ variantId: "B01", ...hand, result });
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((error) => error.code)).toContain("strict_board_high_winner_mismatch");
  });

  it.each([
    ["B02", FLHGameController],
    ["B03", SuperHoldemGameController],
    ["B04", FLSuperHoldemGameController],
    ["B05", PLOGameController],
    ["B06", PLO8GameController],
    ["B07", BigOGameController],
    ["B08", FiveCardPLOGameController],
    ["B09", FLO8GameController],
  ])("enforces strict multi-pot settlement for %s", (variantId, Controller) => {
    const controller = new Controller({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 0 } },
      rng: createDeterministicRng(`strict-${variantId}`),
    });
    const hand = playPassiveHand(controller);
    const gate = validateStrictVariantSettlement({ variantId, ...hand });
    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
  });

  it.each([
    ["ST1", StudGameController],
    ["ST2", Stud8GameController],
    ["ST3", RazzGameController],
    ["ST4", RazzdugiGameController],
    ["ST5", RazzduceyGameController],
    ["ST6", Razz27GameController],
  ])("enforces replay-safe strict Stud settlement for %s", (variantId, Controller) => {
    const controller = new Controller({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 1 } },
      rng: createDeterministicRng(`strict-${variantId}`),
    });
    const hand = playPassiveHand(controller);
    const replayedResult = JSON.parse(JSON.stringify(hand.afterState.lastHandResult));
    const gate = validateStrictVariantSettlement({
      variantId,
      beforeState: hand.beforeState,
      afterState: hand.afterState,
      result: replayedResult,
    });
    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(gate.check.metrics.beforeStackTotal + gate.check.metrics.beforeLivePot).toBe(3000);
    expect(gate.check.metrics.afterStackTotal).toBe(3000);
    expect(replayedResult.potDetails.every((pot) => Array.isArray(pot.eligibleSeatIndexes))).toBe(true);
  });

  it("rejects a tampered Stud winner while preserving payout totals", () => {
    const controller = new StudGameController({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 1 } },
      rng: createDeterministicRng("strict-stud-tamper"),
    });
    const hand = playPassiveHand(controller);
    const result = structuredClone(hand.afterState.lastHandResult);
    const actualWinner = result.potDetails[0].winners[0].seatIndex;
    const wrongWinner = result.potDetails[0].eligibleSeatIndexes.find((seat) => seat !== actualWinner);
    result.potDetails[0].winners = result.potDetails[0].winners.map((winner) => ({
      ...winner,
      seatIndex: wrongWinner,
    }));
    result.winners = result.winners.map((winner) => ({ ...winner, seatIndex: wrongWinner }));
    const gate = validateStrictVariantSettlement({ variantId: "ST1", ...hand, result });
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((error) => error.code)).toContain("strict_stud_component_winner_mismatch");
  });

  it("enforces Stud main/side-pot eligibility and exact chip conservation", () => {
    const controller = new StudGameController({
      tableConfig: { seats: seats().slice(0, 3), blinds: { sb: 5, bb: 10, ante: 0 } },
    });
    controller.state = {
      ...controller.state,
      handId: "stud-side-pot-history-1",
      street: "SEVENTH",
      currentActor: null,
      players: [
        {
          ...controller.state.players[0],
          stack: 90,
          totalInvested: 10,
          holeCards: ["AH", "KH", "QH", "JH", "TH", "2C", "3D"],
          folded: false,
          seatOut: false,
        },
        {
          ...controller.state.players[1],
          stack: 80,
          totalInvested: 20,
          holeCards: ["AS", "AD", "AC", "AH", "KD", "2H", "3C"],
          folded: false,
          seatOut: false,
        },
        {
          ...controller.state.players[2],
          stack: 80,
          totalInvested: 20,
          holeCards: ["KS", "KD", "QC", "QD", "9S", "4H", "3C"],
          folded: false,
          seatOut: false,
        },
      ],
    };
    controller.state.pot = controller.calculatePot();
    const beforeState = structuredClone(controller.getSnapshot());
    controller.resolveShowdown();
    const afterState = controller.getSnapshot();
    const gate = validateStrictVariantSettlement({ variantId: "ST1", beforeState, afterState });

    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(afterState.lastHandResult.potDetails).toMatchObject([
      { amount: 30, eligibleSeatIndexes: [0, 1, 2], winnerSeatIndexes: [0] },
      { amount: 20, eligibleSeatIndexes: [1, 2], winnerSeatIndexes: [1] },
    ]);
    expect(afterState.players.map((player) => player.stack)).toEqual([120, 100, 80]);
    expect(gate.check.metrics.payoutTotal).toBe(50);
    expect(gate.check.metrics.afterStackTotal).toBe(300);
  });

  it("enforces an early uncontested Stud payout before five cards are dealt", () => {
    const controller = new StudGameController({
      tableConfig: { seats: seats().slice(0, 3), blinds: { sb: 5, bb: 10, ante: 0 } },
    });
    controller.state = {
      ...controller.state,
      handId: "stud-uncontested-history-1",
      street: "THIRD",
      currentActor: null,
      players: [
        { ...controller.state.players[0], stack: 90, totalInvested: 10, holeCards: ["AH", "KD", "QC"], folded: false },
        { ...controller.state.players[1], stack: 90, totalInvested: 10, holeCards: ["2H", "3D", "4C"], folded: true },
        { ...controller.state.players[2], stack: 90, totalInvested: 10, holeCards: ["5H", "6D", "7C"], folded: true },
      ],
    };
    controller.state.pot = controller.calculatePot();
    const beforeState = structuredClone(controller.getSnapshot());
    controller.resolveUncontested();
    const afterState = controller.getSnapshot();
    const gate = validateStrictVariantSettlement({ variantId: "ST1", beforeState, afterState });

    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(afterState.lastHandResult.potDetails[0]).toMatchObject({
      amount: 30,
      eligibleSeatIndexes: [0],
      winnerSeatIndexes: [0],
    });
    expect(afterState.players.map((player) => player.stack)).toEqual([120, 90, 90]);
  });
});
