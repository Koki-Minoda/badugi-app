import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  AI_EVAL_DIVERGENCE_REPLAY_DIR,
  runAiEvaluationBatch,
  runProVsStandardEvaluationSuite,
  writeDivergenceReplaySamples,
} from "../runAiEvaluationBatch.js";
import { replayDivergenceAction } from "../replayDivergenceAction.js";
import { runCounterfactualDivergenceScore } from "../runCounterfactualDivergenceScore.js";

describe("counterfactual replay", () => {
  it("validates and replays a saved divergence sample", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "S02",
      seed: 20260506,
      hands: 12,
      playerCount: 6,
    });
    const sample = result.analysis?.divergenceReplaySamples?.[0];
    expect(sample).toBeTruthy();
    const replay = await replayDivergenceAction({
      sample,
      action: sample.proAction,
      rolloutPolicy: "pro",
      rolloutSeeds: [1],
    });
    expect(replay.ok).toBe(true);
    expect(typeof replay.ev).toBe("number");
  });

  it("rejects an illegal replay action safely", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D02",
      seed: 20260507,
      hands: 12,
      playerCount: 6,
    });
    const sample = result.analysis?.divergenceReplaySamples?.[0];
    const replay = await replayDivergenceAction({
      sample,
      action: { type: "DRAW", amount: 1 },
      rolloutPolicy: "pro",
      rolloutSeeds: [1],
    });
    expect(replay.ok).toBe(false);
    expect(replay.errors).toContain("illegal-replay-action");
  });

  it("writes replay samples and generates an aggregate counterfactual report", async () => {
    const suite = await runProVsStandardEvaluationSuite({
      variants: ["S02", "S01", "D02"],
      seed: 20260508,
      hands: 8,
      playerCount: 6,
      options: {
        captureDivergence: true,
        divergenceSampleTag: "step4w",
      },
    });
    await writeDivergenceReplaySamples(suite, { seed: 20260508 });
    const files = await fs.readdir(AI_EVAL_DIVERGENCE_REPLAY_DIR);
    expect(files.some((file) => file.startsWith("step4w-s02-20260508"))).toBe(true);
    const { report, outputPath } = await runCounterfactualDivergenceScore({
      variants: ["S02", "S01", "D02"],
      maxSamples: 20,
      rolloutSeeds: [1],
    });
    expect(report.replaySamples).toBeGreaterThan(0);
    expect(report.bucketResults.length).toBeGreaterThan(0);
    expect(report.bucketResults[0]).toHaveProperty("confidence");
    expect(report.bucketResults[0]).toHaveProperty("stabilityAcrossSeeds");
    expect(typeof outputPath).toBe("string");
    const saved = JSON.parse(await fs.readFile(outputPath, "utf8"));
    expect(saved.bucketResults.length).toBeGreaterThan(0);
  }, 30000);

  it("replay is deterministic for the same sample and seed", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "S01",
      seed: 20260509,
      hands: 12,
      playerCount: 6,
    });
    const sample = result.analysis?.divergenceReplaySamples?.[0];
    const first = await replayDivergenceAction({
      sample,
      action: sample.standardAction,
      rolloutPolicy: "pro",
      rolloutSeeds: [2],
    });
    const second = await replayDivergenceAction({
      sample,
      action: sample.standardAction,
      rolloutPolicy: "pro",
      rolloutSeeds: [2],
    });
    expect(first.ok).toBe(second.ok);
    expect(first.ev).toBe(second.ev);
  });

  it("limits replay samples and respects bucket filters", async () => {
    const { report } = await runCounterfactualDivergenceScore({
      variants: ["S02", "S01", "D02"],
      maxSamples: 5,
      bucketFilter: ["strongSDA5", "strongA5"],
      rolloutSeeds: [1],
    });
    expect(report.replaySamples).toBeLessThanOrEqual(5);
    expect(
      report.bucketResults.every(
        (row) => row.bucket.includes("strongSDA5") || row.bucket.includes("strongA5"),
      ),
    ).toBe(true);
  });
});
