import { describe, expect, it } from "vitest";
import { selectModelForVariant } from "../modelRouter.js";
import {
  buildBoardBetOnnxFeatures,
  buildBadugiOnnxFeatures,
  buildDrawOnnxFeatures,
  buildDeterministicSafeDecision,
  getRlDecisionFallbackPriority,
} from "../onnxPolicyAdapter.js";

describe("onnxPolicyAdapter Badugi schema", () => {
  it("selects tier-specific Badugi models for Beginner, Standard, Pro, Iron, and WorldMaster", () => {
    expect(selectModelForVariant({ variantId: "D03", tierId: "beginner" })?.id).toBe(
      "model-generic-v1",
    );
    expect(selectModelForVariant({ variantId: "D03", tierId: "standard" })?.id).toBe(
      "model-badugi-standard-dqn-v3",
    );
    expect(
      selectModelForVariant({
        variantId: "D03",
        tierId: "standard",
        characterId: "badugi-standard-reader",
      })?.id,
    ).toBe(
      "model-badugi-standard-dqn-v3",
    );
    expect(selectModelForVariant({ variantId: "D03", tierId: "pro" })?.id).toBe(
      "model-badugi-pro-v1",
    );
    expect(selectModelForVariant({ variantId: "D03", tierId: "iron" })?.id).toBe(
      "model-badugi-iron-v1",
    );
    expect(selectModelForVariant({ variantId: "D03", tierId: "worldmaster" })?.id).toBe(
      "model-badugi-worldmaster-v1",
    );
  });

  it("builds exact-shape Badugi ONNX feature tensors", () => {
    const entry = selectModelForVariant({ variantId: "D03", tierId: "iron" });
    const tensor = buildBadugiOnnxFeatures(entry, {
      variantId: "D03",
      state: {
        street: "DRAW",
        drawRoundIndex: 2,
        players: [{ hand: ["AS", "2D", "3C", "4H"], stack: 500 }],
      },
      seatIndex: 0,
      legalActions: ["draw_0", "draw_1"],
    });

    expect(tensor).toBeInstanceOf(Float32Array);
    expect(tensor).toHaveLength(96);
  });

  it("passes EV and range feature slots only to compatible Badugi models", () => {
    const payload = {
      variantId: "D03",
      state: {
        street: "BET",
        drawRoundIndex: 1,
        currentBet: 2,
        pot: 24,
        players: [{ hand: ["AS", "2D", "7C", "KC"], stack: 500, betThisRound: 0 }],
      },
      seatIndex: 0,
      legalActions: ["fold", "call", "raise"],
    };
    const legacyEntry = { inputShape: [96], featureSet: "badugi-observation-v1" };
    const evEntry = { inputShape: [96], featureSet: "badugi-observation-v1-ev" };
    const evRangeEntry = { inputShape: [96], featureSet: "badugi-observation-v1-ev-range" };

    expect(Array.from(buildBadugiOnnxFeatures(legacyEntry, payload).slice(48, 56))).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(Array.from(buildBadugiOnnxFeatures(legacyEntry, payload).slice(58, 61))).toEqual([
      0, 0, 0,
    ]);
    expect(buildBadugiOnnxFeatures(evEntry, payload)[48]).toBeGreaterThan(0);
    expect(buildBadugiOnnxFeatures(evEntry, payload)[54]).toBeGreaterThan(0);
    expect(buildBadugiOnnxFeatures(evEntry, payload)[58]).toBe(0);
    expect(buildBadugiOnnxFeatures(evRangeEntry, payload)[58]).toBeGreaterThan(0);
  });

  it("builds exact-shape draw ONNX feature tensors and selects variant models", () => {
    expect(selectModelForVariant({ variantId: "D01", tierId: "beginner" })?.id).toBe(
      "model-27draw-beginner-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "D01", tierId: "standard" })?.id).toBe(
      "model-27draw-standard-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "D01", tierId: "pro" })?.id).toBe(
      "model-27draw-pro-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "D01", tierId: "iron" })?.id).toBe(
      "model-27draw-iron-v1",
    );
    expect(selectModelForVariant({ variantId: "S01", tierId: "standard" })?.id).toBe(
      "model-27draw-standard-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "D02", tierId: "beginner" })?.id).toBe(
      "model-a5draw-beginner-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "D02", tierId: "standard" })?.id).toBe(
      "model-a5draw-standard-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "D02", tierId: "pro" })?.id).toBe(
      "model-a5draw-pro-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "D02", tierId: "iron" })?.id).toBe(
      "model-a5draw-iron-v1",
    );
    expect(selectModelForVariant({ variantId: "S02", tierId: "standard" })?.id).toBe(
      "model-a5draw-standard-dqn-v1",
    );
    const entry = selectModelForVariant({ variantId: "D01", tierId: "iron" });
    const tensor = buildDrawOnnxFeatures(entry, {
      variantId: "D01",
      state: {
        street: "DRAW",
        players: [{ hand: ["2S", "2H", "9C", "KD", "QS"], stack: 500 }],
      },
      seatIndex: 0,
      legalActions: ["draw_0", "draw_1", "draw_2", "draw_3"],
    });

    expect(tensor).toBeInstanceOf(Float32Array);
    expect(tensor).toHaveLength(96);
  });

  it("builds exact-shape board betting tensors and selects board DQN models", () => {
    expect(selectModelForVariant({ variantId: "B01", tierId: "beginner" })?.id).toBe(
      "model-nlh-beginner-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "B01", tierId: "standard" })?.id).toBe(
      "model-nlh-standard-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "B02", tierId: "standard" })?.id).toBe(
      "model-flh-standard-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "B05", tierId: "standard" })?.id).toBe(
      "model-plo-standard-dqn-v1",
    );
    expect(selectModelForVariant({ variantId: "B06", tierId: "standard" })?.id).toBe(
      "model-plo8-standard-dqn-v1",
    );

    const entry = selectModelForVariant({ variantId: "B06", tierId: "standard" });
    const tensor = buildBoardBetOnnxFeatures(entry, {
      variantId: "B06",
      toCall: 40,
      betSize: 40,
      potSize: 180,
      strength: 0.68,
      equity: 0.58,
      drawPotential: 0.35,
      positionIndex: 4,
      tableSize: 6,
      streetIndex: 2,
      activeOpponents: 3,
      actor: { stack: 500 },
    });

    expect(tensor).toBeInstanceOf(Float32Array);
    expect(tensor).toHaveLength(16);
    expect(tensor[10]).toBe(1);
    expect(tensor[11]).toBe(1);
  });

  it("fails fast on invalid ONNX shape and exposes fallback priority", () => {
    expect(() =>
      buildBadugiOnnxFeatures({ inputShape: [95] }, { variantId: "D03", state: {} }),
    ).toThrow(/does not match 95/);
    expect(getRlDecisionFallbackPriority()).toEqual(["onnx", "ruleBased", "deterministicSafe"]);
    expect(buildDeterministicSafeDecision(["raise", "call"])).toEqual({
      action: "CALL",
      source: "deterministic-safe",
    });
  });
});
