import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AI_EVAL_DIVERGENCE_REPLAY_DIR,
  runAiEvaluationBatch,
  runProVsStandardEvaluationSuite,
  writeDivergenceReplaySamples,
} from "../runAiEvaluationBatch.js";
import { auditReplayDeterminism } from "../auditReplayDeterminism.js";
import { replayDivergenceAction } from "../replayDivergenceAction.js";
import { createActionHash, createReplayStateHash } from "../replayDeterminismHash.js";

describe("replay determinism", () => {
  it("creates stable hashes independent of object key order and volatile fields", () => {
    const first = {
      snapshot: {
        variantId: "D02",
        currentActor: 0,
        drawRound: 1,
        bettingRound: 0,
        pot: 10,
        seed: 1,
        legalActions: [{ type: "call", amount: 5 }, { amount: 10, type: "raise" }],
        players: [{ stack: 100, cards: ["As", "2d"] }],
        timestamp: 123,
      },
    };
    const second = {
      snapshot: {
        players: [{ cards: ["As", "2d"], stack: 100 }],
        legalActions: [{ amount: 5, type: "call" }, { type: "raise", amount: 10 }],
        pot: 10,
        bettingRound: 0,
        drawRound: 1,
        currentActor: 0,
        variantId: "D02",
        seed: 1,
        timestamp: 999,
      },
    };
    expect(createReplayStateHash(first)).toBe(createReplayStateHash(second));
    expect(createActionHash({ type: "raise", amount: 10 })).toBe(createActionHash({ amount: 10, type: "raise" }));
  });

  it("classifies invalid replay actions", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "S02",
      seed: 20260506,
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
    expect(replay.invalidReason).toBe("INVALID_ACTION");
  });

  it("audits replay determinism for a tagged corpus", async () => {
    const seed = 20260514;
    const tag = "step3test";
    const suite = await runProVsStandardEvaluationSuite({
      variants: ["D02", "S01"],
      seed,
      hands: 8,
      playerCount: 6,
      options: {
        captureDivergence: true,
        divergenceSampleTag: tag,
      },
    });
    await writeDivergenceReplaySamples(suite, { seed });
    const { report, outputPath } = await auditReplayDeterminism({
      variants: ["D02", "S01"],
      sampleTagFilter: [tag],
      maxSamples: 10,
      repeats: 2,
      outputPath: path.join(AI_EVAL_DIVERGENCE_REPLAY_DIR, "..", "replay-determinism-audit-step3-test.json"),
    });
    expect(report.replaySamples).toBeGreaterThan(0);
    expect(typeof report.deterministic).toBe("boolean");
    const saved = JSON.parse(await fs.readFile(outputPath, "utf8"));
    expect(saved).toHaveProperty("mismatchCount");
  }, 120000);
});
