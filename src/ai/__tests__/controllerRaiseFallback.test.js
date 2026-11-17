import { describe, expect, it } from "vitest";
import { buildControllerRaiseFallbackPayload } from "../qa/controllerRaiseFallback.js";

describe("controller raise fallback attribution", () => {
  it("records a rejected model raise as fallback while retaining its attempted model", () => {
    const attempt = {
      type: "raise", amount: 100, modelId: "model-badugi-worldmaster-v1",
      inferenceTrace: {
        variantId: "D03", tierId: "worldmaster", phase: "BET",
        selectedModelId: "model-badugi-worldmaster-v1",
        usedModelId: "model-badugi-worldmaster-v1", status: "used", elapsedMs: 23,
      },
    };
    const fallback = buildControllerRaiseFallbackPayload(attempt, 50, "FL_RAISE_AMOUNT");
    expect(fallback).toMatchObject({
      type: "call", amount: 50, selectedAction: "raise", finalAction: "call",
      decisionSource: "controller-raise-fallback", illegalActionRejected: true,
      inferenceTrace: {
        selectedModelId: "model-badugi-worldmaster-v1", usedModelId: null,
        status: "fallback", reason: "controller-rejected-raise:FL_RAISE_AMOUNT",
      },
    });
    expect(attempt.inferenceTrace.status).toBe("used");
  });

  it("attributes a rejected teacher raise rather than leaving an anonymous check", () => {
    const fallback = buildControllerRaiseFallbackPayload({
      type: "raise", inferenceTrace: { status: "not-connected", usedModelId: null },
    }, 0);
    expect(fallback).toMatchObject({
      type: "check", amount: 0, selectedAction: "raise", finalAction: "check",
      inferenceTrace: { status: "fallback", usedModelId: null },
    });
  });
});
