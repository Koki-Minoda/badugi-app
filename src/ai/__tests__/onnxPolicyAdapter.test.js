import { describe, expect, it } from "vitest";
import { selectModelForVariant } from "../modelRouter.js";
import {
  buildBadugiOnnxFeatures,
  buildDeterministicSafeDecision,
  getRlDecisionFallbackPriority,
} from "../onnxPolicyAdapter.js";

describe("onnxPolicyAdapter Badugi schema", () => {
  it("selects tier-specific Badugi models for Pro, Iron, and WorldMaster", () => {
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
