import { describe, expect, it } from "vitest";

import {
  canStoreReplaySample,
  normalizeDivergenceOptions,
} from "../runAiEvaluationBatch.js";

describe("bucket quota sampling", () => {
  it("excludes trash verify buckets for iron-step5", () => {
    const options = normalizeDivergenceOptions({
      captureDivergence: true,
      divergenceSampleTag: "iron-step5",
      maxReplaySamples: 16000,
    });
    const analysis = { divergenceReplaySamples: [] };
    const sample = {
      variantId: "S02",
      handClass: "trashSDA5",
      facingAction: "bet",
      playerCount: 4,
    };

    expect(canStoreReplaySample(sample, analysis, options)).toBe(false);
  });

  it("applies preset bucket quotas for targeted buckets", () => {
    const options = normalizeDivergenceOptions({
      captureDivergence: true,
      divergenceSampleTag: "iron-step5",
      maxReplaySamples: 16000,
    });
    const targeted = {
      variantId: "S01",
      handClass: "strongSD27",
      facingAction: "bet",
      playerCount: 3,
    };
    const analysis = {
      divergenceReplaySamples: Array.from({ length: 1200 }, () => ({
        variantId: "S01",
        handClass: "strongSD27",
        facingAction: "bet",
        playerCount: 3,
      })),
    };

    expect(canStoreReplaySample(targeted, analysis, options)).toBe(false);
  });

  it("applies D01-focused quota presets for iron-step6", () => {
    const options = normalizeDivergenceOptions({
      captureDivergence: true,
      divergenceSampleTag: "iron-step6",
      maxReplaySamples: 22000,
    });
    const targeted = {
      variantId: "D01",
      handClass: "strong27TD",
      facingAction: "bet",
      playerCount: 3,
    };
    const analysis = {
      divergenceReplaySamples: Array.from({ length: 2000 }, () => ({
        variantId: "D01",
        handClass: "strong27TD",
        facingAction: "bet",
        playerCount: 3,
      })),
    };

    expect(canStoreReplaySample(targeted, analysis, options)).toBe(false);
  });
});
