import { describe, expect, it } from "vitest";

import { analyzeActionDivergence } from "../analyzeActionDivergence.js";
import { runAiEvaluationBatch, runProVsStandardEvaluationSuite } from "../runAiEvaluationBatch.js";

describe("action divergence mining", () => {
  it("captures both actions and preserves safety on a live smoke batch", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "S02",
      seed: 20260506,
      hands: 12,
      playerCount: 6,
    });
    const records = result.analysis?.divergenceRecords ?? [];
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((record) => record.proAction && record.standardAction)).toBe(true);
    expect(result.resultsByTier.pro.fallbackRate).toBe(0);
    expect(result.resultsByTier.pro.illegalActionRate).toBe(0);
    expect(result.resultsByTier.pro.freezeRate).toBe(0);
    expect(result.resultsByTier.pro.evIntegrityFailureRate).toBe(0);
  });

  it("records realized EV deltas on divergence rows", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D02",
      seed: 20260507,
      hands: 12,
      playerCount: 6,
    });
    const records = result.analysis?.divergenceRecords ?? [];
    const withDelta = records.find(
      (record) => typeof record.proEvDelta === "number" || typeof record.standardEvDelta === "number",
    );
    expect(withDelta).toBeTruthy();
  });

  it("assigns divergence categories and ranks them", () => {
    const report = {
      variants: {
        S02: {
          analysis: {
            divergenceRecords: [
              {
                variantId: "S02",
                handId: 1,
                drawRound: 1,
                bettingRound: 1,
                playerCount: 2,
                position: "button",
                facingAction: "bet",
                handClass: "premiumSDA5",
                proAction: "CALL",
                standardAction: "RAISE",
                proEvDelta: 10,
                standardEvDelta: 22,
              },
              {
                variantId: "S02",
                handId: 2,
                drawRound: 1,
                bettingRound: 1,
                playerCount: 4,
                position: "early",
                facingAction: "bet",
                handClass: "trashSDA5",
                proAction: "CALL",
                standardAction: "FOLD",
                proEvDelta: -12,
                standardEvDelta: -2,
              },
            ],
          },
        },
      },
    };
    const analysis = analyzeActionDivergence(report);
    expect(analysis.divergenceCount).toBe(2);
    expect(analysis.ranked.length).toBeGreaterThan(0);
    expect(analysis.ranked.some((entry) => entry.category === "underraise")).toBe(true);
    expect(analysis.ranked.some((entry) => entry.category === "weak-defense")).toBe(true);
  });

  it("suite report includes action divergence output", async () => {
    const suite = await runProVsStandardEvaluationSuite({
      variants: ["S02", "S01", "D02"],
      seed: 20260508,
      hands: 8,
      playerCount: 6,
      options: {
        captureDivergence: true,
        maxReplaySamples: 4,
        divergenceBucketFilter: ["strongSDA5", "strongA5", "strongSD27"],
      },
    });
    expect(suite.actionDivergence).toBeTruthy();
    expect(typeof suite.actionDivergence.divergenceCount).toBe("number");
    const s02Samples = suite.variants.S02.analysis?.divergenceReplaySamples ?? [];
    expect(s02Samples.length).toBeLessThanOrEqual(4);
  });
});
