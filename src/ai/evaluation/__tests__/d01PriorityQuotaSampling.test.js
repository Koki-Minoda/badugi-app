import { describe, expect, it } from "vitest";

import {
  canStoreReplaySample,
  normalizeDivergenceOptions,
} from "../runAiEvaluationBatch.js";

describe("D01 priority quota sampling", () => {
  it("prioritizes D01 late pressure buckets for iron-step6", () => {
    const options = normalizeDivergenceOptions({
      captureDivergence: true,
      divergenceSampleTag: "iron-step6",
      maxReplaySamples: 22000,
    });

    expect(options.variantQuotaConfig.D01).toBeGreaterThan(options.variantQuotaConfig.D02);
    expect(options.bucketQuotaConfig.D01["premium27TD late pressure"]).toBe(2000);
    expect(options.bucketQuotaConfig.D01["strong27TD late pressure"]).toBe(2000);
    expect(options.bucketQuotaConfig.D01["medium27TD pressure"]).toBe(1200);

    const targeted = {
      variantId: "D01",
      handClass: "premium27TD",
      facingAction: "bet",
      playerCount: 2,
    };
    const capped = {
      divergenceReplaySamples: Array.from({ length: 2000 }, () => ({
        variantId: "D01",
        handClass: "premium27TD",
        facingAction: "bet",
        playerCount: 2,
      })),
    };
    expect(canStoreReplaySample(targeted, capped, options)).toBe(false);
  });
});

