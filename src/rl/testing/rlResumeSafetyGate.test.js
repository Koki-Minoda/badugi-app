import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, test } from "vitest";
import { selectModelForVariant } from "../../ai/modelRouter.js";
import {
  buildBadugiOnnxFeatures,
  buildDeterministicSafeDecision,
  buildDrawOnnxFeatures,
} from "../../ai/onnxPolicyAdapter.js";
import { runOneHandProgression } from "../../games/testing/scenario/runOneHandProgression.js";
import {
  BADUGI_OBSERVATION_VECTOR_SIZE,
  buildBadugiObservationPayload,
} from "../badugiObservationSchema.js";
import {
  DRAW_OBSERVATION_VECTOR_SIZE,
  buildDrawObservationPayload,
  getDrawVariantRlConfig,
} from "../drawObservationSchema.js";
import {
  RL_TARGET_VARIANTS,
  summarizeRlTransitionValidation,
  validateRlTransition,
} from "./validateRlTransition.js";

const ROOT_DIR = path.resolve(import.meta.dirname, "../../..");

function expectFiniteVector(vector, size, label) {
  expect(vector, `${label} length`).toHaveLength(size);
  vector.forEach((value, index) => {
    expect(Number.isFinite(Number(value)), `${label}[${index}]`).toBe(true);
  });
}

function badugiPayload(legalActions = ["fold", "call", "raise"]) {
  return buildBadugiObservationPayload({
    state: {
      variantId: "D03",
      street: "BET",
      drawRoundIndex: 2,
      currentBet: 20,
      pot: 120,
      players: [
        { seatIndex: 0, stack: 500, betThisRound: 0, hand: ["AS", "2D", "3C", "4H"] },
        { seatIndex: 1, stack: 480, betThisRound: 20, hand: ["KS", "QD", "9C", "7H"] },
      ],
    },
    seatIndex: 0,
    legalActions,
  });
}

function drawPayload(variantId, legalActions = ["draw_0", "draw_1", "draw_2", "draw_3", "draw_4", "draw_5"]) {
  return buildDrawObservationPayload({
    state: {
      variantId,
      street: "DRAW",
      drawRoundIndex: variantId.startsWith("S") ? 0 : 2,
      metadata: { variantId, currentBet: 20 },
      players: [
        {
          seatIndex: 0,
          stack: 500,
          hand:
            variantId === "D02" || variantId === "S02"
              ? ["AS", "2D", "3C", "4H", "9S"]
              : ["2S", "3D", "4C", "5H", "KS"],
        },
      ],
    },
    seatIndex: 0,
    variantId,
    legalActions,
  });
}

function vectorTransition(overrides = {}) {
  const observation = Array.from({ length: 96 }, (_, index) => index / 100);
  const nextObservation = Array.from({ length: 96 }, (_, index) => (95 - index) / 100);
  return {
    variantId: "D01",
    schemaVersion: "draw-observation-v1",
    source: "unit-fixture",
    observation,
    action: "draw_2",
    reward: 0.25,
    next_observation: nextObservation,
    done: false,
    legal_actions: ["draw_0", "draw_1", "draw_2", "draw_3"],
    metadata: {
      drawInfo: {
        drawCount: 2,
        discardIndexes: [0, 1],
      },
    },
    ...overrides,
  };
}

describe("MGX RL resume safety gate", () => {
  test.each(RL_TARGET_VARIANTS)("%s completes one controller hand before training resumes", async (variantId) => {
    const result = await runOneHandProgression({
      variantId,
      family: variantId === "D03" ? "DRAW" : "DRAW",
      seed: 20260506,
      maxSteps: 320,
    });

    expect(
      result.status,
      JSON.stringify({ reason: result.reason, lastTrace: result.trace.at(-1) ?? result }, null, 2),
    ).toBe("PASS");
    expect(result.handEnded).toBe(true);
  });

  it("validates Badugi 96-dim schema and ONNX feature shape", () => {
    const payload = badugiPayload();
    const entry = selectModelForVariant({ variantId: "D03", tierId: "pro" });
    expect(BADUGI_OBSERVATION_VECTOR_SIZE).toBe(96);
    expect(entry.inputShape).toEqual([96]);
    expectFiniteVector(buildBadugiOnnxFeatures(entry, payload), 96, "badugi-onnx");
  });

  test.each(["D01", "D02", "S01", "S02"])("%s validates draw 96-slot schema and ONNX route", (variantId) => {
    const config = getDrawVariantRlConfig(variantId);
    expect(config).toBeTruthy();
    const payload = drawPayload(variantId);
    const entry = selectModelForVariant({ variantId, tierId: "standard" });
    expect(DRAW_OBSERVATION_VECTOR_SIZE).toBe(96);
    expect(entry.inputShape).toEqual([96]);
    expectFiniteVector(buildDrawOnnxFeatures(entry, payload), 96, `${variantId}-draw-onnx`);
    expect(payload.features.maxDrawRounds).toBe(variantId.startsWith("S") ? 1 : 3);
  });

  it("rejects corrupt RL transitions before dataset training", () => {
    const valid = validateRlTransition(vectorTransition());
    expect(valid.ok).toBe(true);

    const invalid = summarizeRlTransitionValidation([
      vectorTransition({ action: "raise" }),
      vectorTransition({ observation: [0, 1, 2] }),
      vectorTransition({ reward: Number.NaN }),
      vectorTransition({ metadata: { drawInfo: { drawCount: 3, discardIndexes: [0, 1] } } }),
    ]);
    expect(invalid.trainingAllowed).toBe(false);
    expect(invalid.invalid).toBe(4);
    expect(invalid.invalidReasons).toMatchObject({
      action_not_in_legal_actions: 1,
      observation_shape_mismatch: 1,
      reward_not_finite: 1,
      draw_count_discard_indexes_mismatch: 1,
    });
  });

  it("exports dataset validation summary and fails clean mode on invalid records", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "mgx-rl-safety-"));
    const inputPath = path.join(tempDir, "hand_logs.jsonl");
    const outputPath = path.join(tempDir, "dataset.json");
    const validVector = Array.from({ length: 96 }, (_, index) => index / 100);
    const record = {
      handId: "D01-SAFE-001",
      variantId: "D01",
      actions: [
        {
          handId: "D01-SAFE-001",
          variantId: "D01",
          seat: 0,
          phase: "DRAW",
          action: "DRAW",
          stateVector: validVector,
          legalActions: ["draw_0", "draw_1", "draw_2"],
          metadata: {
            actionId: "a1",
            variantId: "D01",
            drawInfo: { drawCount: 2, discardIndexes: [0, 1] },
          },
          reward: 0.1,
        },
        {
          handId: "D01-SAFE-001",
          variantId: "D01",
          seat: 0,
          phase: "BET",
          action: "raise",
          stateVector: validVector,
          legalActions: ["fold", "call"],
          metadata: { actionId: "a2", variantId: "D01" },
          reward: 0.0,
        },
      ],
    };
    writeFileSync(inputPath, `${JSON.stringify(record)}\n`, "utf8");

    execFileSync("python3", ["src/rl/tools/export_dataset.py", "--input", inputPath, "--output", outputPath], {
      cwd: ROOT_DIR,
      stdio: "pipe",
    });
    const dataset = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(dataset.validation_summary).toMatchObject({
      total: 2,
      valid: 1,
      invalid: 1,
      trainingAllowed: false,
    });
    expect(dataset.validation_summary.invalidReasons.action_not_in_legal_actions).toBe(1);

    expect(() =>
      execFileSync(
        "python3",
        ["src/rl/tools/export_dataset.py", "--input", inputPath, "--output", outputPath, "--require-clean-dataset"],
        { cwd: ROOT_DIR, stdio: "pipe" },
      ),
    ).toThrow();
  });

  it("documents fallback priority and keeps deterministic fallback legal", () => {
    expect(() => buildBadugiOnnxFeatures({ inputShape: [95] }, badugiPayload())).toThrow(/does not match/);
    expect(buildDeterministicSafeDecision(["raise", "call"])).toEqual({
      action: "CALL",
      source: "deterministic-safe",
    });
    expect(buildDeterministicSafeDecision([])).toBeNull();
  });
});
