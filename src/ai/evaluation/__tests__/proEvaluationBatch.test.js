import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  runAiEvaluationBatch,
  runProVsStandardEvaluationSuite,
  writeEvaluationJson,
} from "../runAiEvaluationBatch.js";

describe("Pro evaluation batch", () => {
  it("EVAL-001 Badugi Standard vs Pro 20-hand smoke run completes", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D03",
      seed: 20260506,
      hands: 20,
      playerCount: 6,
    });
    expect(result.handsCompleted).toBe(20);
    expect(result.summary.handCompletionRate).toBe(1);
  });

  it("EVAL-002 D01 Standard vs Pro 20-hand smoke run completes", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D01",
      seed: 20260506,
      hands: 20,
      playerCount: 6,
    });
    expect(result.handsCompleted).toBe(20);
  });

  it("EVAL-003 D02 Standard vs Pro 20-hand smoke run completes", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D02",
      seed: 20260506,
      hands: 20,
      playerCount: 6,
    });
    expect(result.handsCompleted).toBe(20);
  });

  it("EVAL-004 S01/S02 single-draw smoke runs complete", async () => {
    const s01 = await runAiEvaluationBatch({
      variantId: "S01",
      seed: 20260506,
      hands: 20,
      playerCount: 6,
    });
    const s02 = await runAiEvaluationBatch({
      variantId: "S02",
      seed: 20260506,
      hands: 20,
      playerCount: 6,
    });
    expect(s01.handsCompleted).toBe(20);
    expect(s02.handsCompleted).toBe(20);
  });

  it("EVAL-005 illegalActionRate stays at 0 for required variants", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D01",
      seed: 20260507,
      hands: 20,
      playerCount: 6,
    });
    expect(result.resultsByTier.standard.illegalActionRate).toBe(0);
    expect(result.resultsByTier.pro.illegalActionRate).toBe(0);
  });

  it("EVAL-006 evIntegrityFailureRate stays at 0 for required variants", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D02",
      seed: 20260507,
      hands: 20,
      playerCount: 6,
    });
    expect(result.resultsByTier.standard.evIntegrityFailureRate).toBe(0);
    expect(result.resultsByTier.pro.evIntegrityFailureRate).toBe(0);
  });

  it("EVAL-007 freezeRate stays at 0 for required variants", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D03",
      seed: 20260508,
      hands: 20,
      playerCount: 6,
    });
    expect(result.resultsByTier.standard.freezeRate).toBe(0);
    expect(result.resultsByTier.pro.freezeRate).toBe(0);
  });

  it("EVAL-008 fallbackRate and proOverlayRate are aggregated", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D03",
      seed: 20260509,
      hands: 20,
      playerCount: 6,
    });
    expect(typeof result.resultsByTier.pro.fallbackRate).toBe("number");
    expect(typeof result.resultsByTier.pro.proOverlayRate).toBe("number");
  });

  it("PRO-D03-FALLBACK-001 keeps Badugi Pro fallback below 30% in smoke eval", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "D03",
      seed: 20260506,
      hands: 20,
      playerCount: 6,
    });
    expect(result.resultsByTier.pro.fallbackRate).toBeLessThan(0.3);
  });

  it("EVAL-009 mirrored seat run metadata is available", async () => {
    const result = await runAiEvaluationBatch({
      variantId: "S01",
      seed: 20260510,
      hands: 20,
      playerCount: 6,
    });
    expect(result.seatAssignments.primary).toHaveLength(6);
    expect(result.seatAssignments.mirrored).toHaveLength(6);
    expect(result.traces.some((trace) => trace.seatAssignments?.[0]?.tier === "pro")).toBe(true);
    expect(result.traces.some((trace) => trace.seatAssignments?.[0]?.tier === "standard")).toBe(true);
  });

  it("EVAL-010 evaluation result JSON can be generated", async () => {
    const suite = await runProVsStandardEvaluationSuite({
      variants: ["D03", "D01", "D02", "S01", "S02", "B01"],
      seed: 20260511,
      hands: 8,
      playerCount: 6,
    });
    const outputPath = path.join(os.tmpdir(), `mgx-ai-eval-${Date.now()}.json`);
    await writeEvaluationJson(suite, outputPath);
    const content = JSON.parse(await fs.readFile(outputPath, "utf8"));
    expect(content.runId).toBe("pro-vs-standard-20260511");
    expect(content.variants.D03.handsCompleted).toBe(8);
    expect(content.variants.B01.status).toBe("NOT_RUN");
  });
});
