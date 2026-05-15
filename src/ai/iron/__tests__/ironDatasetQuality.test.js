import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkIronDatasetQuality } from "../checkIronDatasetQuality.js";

function buildRow(overrides = {}) {
  return {
    variantId: "D02",
    schemaVersion: 1,
    observation: new Array(96).fill(0),
    legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
    candidateActions: [
      {
        action: { type: "RAISE" },
        source: "standard",
        estimatedValue: 10,
        sampleCount: 60,
        confidence: 1,
        verdict: "GOOD",
      },
    ],
    chosenBestAction: { type: "RAISE" },
    handClass: "strongA5",
    bucket: "strongA5 second-pressure",
    sourceCorpusTag: "iron-step2",
    sourceCounterfactualScore: "reports/ai-eval/counterfactual-score-d02-s01-s02-iron-step2.json",
    trainingWeight: 1,
    metadata: { seed: 1, handId: 1, step: 1, actorSeat: 0 },
    ...overrides,
  };
}

describe("iron dataset quality gate", () => {
  it("allows supervised-only and blocks iron-candidate for a single-variant dataset", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mgx-iron-quality-"));
    const datasetPath = path.join(tmpDir, "dataset.jsonl");
    await fs.writeFile(
      datasetPath,
      [buildRow(), buildRow({ metadata: { seed: 2, handId: 2, step: 2, actorSeat: 1 } })]
        .map((row) => JSON.stringify(row))
        .join("\n"),
      "utf8",
    );
    const determinismPath = path.join(tmpDir, "determinism.json");
    const counterfactualPath = path.join(tmpDir, "counterfactual.json");
    await fs.writeFile(
      determinismPath,
      JSON.stringify({ deterministic: true, invalidReplayCount: 0 }, null, 2),
      "utf8",
    );
    await fs.writeFile(
      counterfactualPath,
      JSON.stringify({ invalidReplays: 0 }, null, 2),
      "utf8",
    );

    const result = await checkIronDatasetQuality({
      datasetPath,
      determinismPath,
      counterfactualPath,
      outputPath: path.join(tmpDir, "quality.json"),
    });

    expect(result.okForSupervisedTraining).toBe(true);
    expect(result.okForIronCandidate).toBe(false);
    expect(result.blockers).toContain("insufficient-variant-coverage-for-iron-candidate");
    expect(result.promoted).toBe(false);
    expect(result.eligibleForPromotion).toBe(false);
  });
});
