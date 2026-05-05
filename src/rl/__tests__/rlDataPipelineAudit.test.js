import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { selectModelForVariant } from "../../ai/modelRouter.js";
import {
  buildBadugiOnnxFeatures,
  buildDrawOnnxFeatures,
} from "../../ai/onnxPolicyAdapter.js";
import {
  BADUGI_OBSERVATION_VECTOR_SIZE,
  buildBadugiObservationPayload,
  buildBadugiObservationVector,
} from "../badugiObservationSchema.js";
import {
  DRAW_OBSERVATION_VECTOR_SIZE,
  buildDrawObservationPayload,
  buildDrawObservationVector,
  getDrawVariantRlConfig,
} from "../drawObservationSchema.js";

const ROOT_DIR = path.resolve(import.meta.dirname, "../../..");

function expectFiniteVector(vector, size) {
  expect(vector).toHaveLength(size);
  vector.forEach((value, index) => {
    expect(value, `vector[${index}]`).not.toBeNull();
    expect(value, `vector[${index}]`).not.toBeUndefined();
    expect(Number.isFinite(Number(value)), `vector[${index}]`).toBe(true);
  });
}

function sampleDrawState(variantId) {
  return {
    variantId,
    street: "DRAW",
    drawRoundIndex: variantId.startsWith("S") ? 0 : 2,
    metadata: { variantId, currentBet: 20 },
    players: [
      {
        seatIndex: 0,
        stack: 500,
        betThisRound: 0,
        hand:
          variantId === "D02" || variantId === "S02"
            ? ["AS", "2D", "3C", "4H", "9S"]
            : ["2S", "3D", "4C", "5H", "KS"],
      },
    ],
  };
}

describe("RL data pipeline audit guards", () => {
  it("keeps Badugi observation, ONNX features, and action mask at 96 finite slots", () => {
    const payload = buildBadugiObservationPayload({
      state: {
        variantId: "D03",
        street: "BET",
        drawRoundIndex: 3,
        currentBet: 20,
        pot: 120,
        players: [
          {
            seatIndex: 0,
            stack: 480,
            betThisRound: 0,
            hand: ["AS", "2D", "3C", "4H"],
          },
          {
            seatIndex: 1,
            stack: 520,
            lastDrawCount: 2,
            hand: ["KS", "KD", "9C", "7H"],
          },
        ],
      },
      seatIndex: 0,
      legalActions: ["fold", "call", "raise"],
    });
    const vector = buildBadugiObservationVector(payload);
    expectFiniteVector(vector, BADUGI_OBSERVATION_VECTOR_SIZE);
    expect(vector[32]).toBe(1);
    expect(vector[34]).toBe(1);
    expect(vector[36]).toBe(1);

    const entry = selectModelForVariant({ variantId: "D03", tierId: "pro" });
    expect(entry.inputShape).toEqual([96]);
    expectFiniteVector(buildBadugiOnnxFeatures(entry, payload), 96);
  });

  it.each([
    ["D01", "low-27", 3, 41],
    ["D02", "low-a5", 3, 42],
    ["S01", "low-27", 1, 41],
    ["S02", "low-a5", 1, 42],
  ])(
    "keeps %s draw observation and model routing at 96 finite slots",
    (variantId, family, maxDrawRounds, featureSlot) => {
      const config = getDrawVariantRlConfig(variantId);
      expect(config).toMatchObject({ family, drawRounds: maxDrawRounds });
      const payload = buildDrawObservationPayload({
        state: sampleDrawState(variantId),
        seatIndex: 0,
        variantId,
        legalActions: ["draw_0", "draw_1", "draw_2", "draw_3", "draw_4", "draw_5"],
      });
      const vector = buildDrawObservationVector(payload);
      expect(payload.features.maxDrawRounds).toBe(maxDrawRounds);
      expect(payload.features.handSize).toBe(5);
      expectFiniteVector(vector, DRAW_OBSERVATION_VECTOR_SIZE);
      expect(vector[featureSlot]).toBe(1);
      expect(vector[48 + 5]).toBe(1);
      expect(vector[48 + 10]).toBe(1);

      const entry = selectModelForVariant({ variantId, tierId: "standard" });
      expect(entry.inputShape).toEqual([96]);
      expect(entry.outputShape).toEqual([11]);
      expectFiniteVector(buildDrawOnnxFeatures(entry, payload), 96);
    },
  );

  it("exports transition records without draw action or variant corruption", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "mgx-rl-audit-"));
    const inputPath = path.join(tempDir, "hand_logs.jsonl");
    const outputPath = path.join(tempDir, "dataset.json");
    const vector = Array.from({ length: 96 }, (_, index) => index / 100);
    const nextVector = Array.from({ length: 96 }, (_, index) => (95 - index) / 100);
    const record = {
      handId: "D01-H001",
      variantId: "D01",
      actions: [
        {
          handId: "D01-H001",
          variantId: "D01",
          seat: 0,
          phase: "DRAW",
          action: "DRAW",
          stateVector: vector,
          legalActions: ["draw_0", "draw_1", "draw_2", "draw_3", "draw_4", "draw_5"],
          metadata: {
            actionId: "a1",
            variantId: "D01",
            drawInfo: {
              drawCount: 5,
              discardIndexes: [0, 1, 2, 3, 4],
            },
          },
        },
        {
          handId: "D01-H001",
          variantId: "D01",
          seat: 0,
          phase: "BET",
          action: "call",
          stateVector: nextVector,
          legalActions: ["fold", "call", "raise"],
          metadata: { actionId: "a2", variantId: "D01" },
          reward: 0.25,
        },
      ],
    };
    writeFileSync(inputPath, `${JSON.stringify(record)}\n`, "utf8");

    execFileSync("python3", ["src/rl/tools/export_dataset.py", "--input", inputPath, "--output", outputPath], {
      cwd: ROOT_DIR,
      stdio: "pipe",
    });

    const dataset = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(dataset).toMatchObject({
      schema_version: "badugi-observation-v1",
      format: "transition",
      count: 2,
    });
    const [drawTransition, betTransition] = dataset.records;
    expect(drawTransition.action).toBe("draw_5");
    expect(drawTransition.legal_actions).toContain("draw_5");
    expect(drawTransition.metadata.variant_id).toBe("D01");
    expect(drawTransition.metadata.warnings).toEqual([]);
    expectFiniteVector(drawTransition.observation, 96);
    expectFiniteVector(drawTransition.next_observation, 96);
    expect(betTransition.reward).toBe(0.25);
    expect(betTransition.done).toBe(true);
    expect(betTransition.action).toBe("call");
    expect(betTransition.legal_actions).toContain("call");
    expect(betTransition.metadata.warnings).toEqual([]);
  });
});
