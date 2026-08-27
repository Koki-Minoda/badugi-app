import { describe, expect, it } from "vitest";
import { GAME_VARIANTS } from "../../config/variantCatalog.js";
import { NLHGameController } from "../../nlh/NLHGameController.js";
import { FLHGameController } from "../../nlh/FLHGameController.js";
import { PLOGameController } from "../../plo/PLOGameController.js";
import { PLO8GameController } from "../../plo/PLO8GameController.js";
import { FLO8GameController } from "../../plo/FLO8GameController.js";
import { createDeterministicRng } from "../deterministicRng.js";
import {
  STRICT_SETTLEMENT_ALLOWLIST,
  getStrictSettlementPolicy,
  validateStrictVariantSettlement,
} from "./strictVariantSettlementGate.js";

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
      "B01", "B02", "B05", "B06", "B09",
    ]);
    expect(policies.filter((policy) => policy.status === "UNCLASSIFIED")).toEqual([]);
    expect(Object.keys(STRICT_SETTLEMENT_ALLOWLIST)).toHaveLength(31);
    policies.filter((policy) => policy.status === "ALLOWLISTED").forEach((policy) => {
      expect(policy.reason).toEqual(expect.any(String));
      expect(policy.reason.length).toBeGreaterThan(30);
    });
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
    ["B05", PLOGameController],
    ["B06", PLO8GameController],
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
});
