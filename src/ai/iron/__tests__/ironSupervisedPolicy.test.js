import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { trainIronSupervisedPolicy } from "../trainIronSupervisedPolicy.js";

function buildRow(overrides = {}) {
  return {
    variantId: "D02",
    schemaVersion: 1,
    observation: new Array(96).fill(0),
    legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
    candidateActions: [
      {
        action: { type: "FOLD" },
        source: "pro",
        estimatedValue: -10,
        sampleCount: 30,
        confidence: 0.92,
        verdict: "BAD",
      },
      {
        action: { type: "RAISE" },
        source: "standard",
        estimatedValue: 30,
        sampleCount: 30,
        confidence: 0.92,
        verdict: "GOOD",
      },
    ],
    chosenBestAction: { type: "RAISE" },
    handClass: "strongA5",
    bucket: "strongA5 second-pressure",
    sourceCorpusTag: "iron-step2",
    sourceCounterfactualScore: "reports/ai-eval/counterfactual-score-d02-s01-s02-iron-step2.json",
    trainingWeight: 0.552,
    metadata: { seed: 1, handId: 1, step: 1, actorSeat: 0 },
    ...overrides,
  };
}

async function writeDataset(rows) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mgx-iron-supervised-"));
  const datasetPath = path.join(tmpDir, "dataset.jsonl");
  await fs.writeFile(datasetPath, rows.map((row) => JSON.stringify(row)).join("\n"), "utf8");
  return { tmpDir, datasetPath };
}

describe("Iron supervised policy bootstrap", () => {
  it("builds split, label mapping, and metadata for a valid dataset", async () => {
    const { tmpDir, datasetPath } = await writeDataset([
      buildRow(),
      buildRow({ metadata: { seed: 2, handId: 2, step: 2, actorSeat: 1 } }),
      buildRow({ metadata: { seed: 3, handId: 3, step: 3, actorSeat: 2 } }),
      buildRow({ metadata: { seed: 4, handId: 4, step: 4, actorSeat: 3 } }),
      buildRow({ metadata: { seed: 5, handId: 5, step: 5, actorSeat: 4 } }),
    ]);
    const result = await trainIronSupervisedPolicy({
      datasetPath,
      reportOutputPath: path.join(tmpDir, "report.json"),
      metadataOutputPath: path.join(tmpDir, "meta.json"),
      docOutputPath: path.join(tmpDir, "report.md"),
    });
    expect(result.trainingAllowed).toBe(true);
    expect(result.trainRows).toBeGreaterThan(0);
    expect(result.validationRows).toBeGreaterThan(0);
    expect(result.labelMapping.RAISE).toBeTypeOf("number");
    expect(result.confidenceWeightedSummary.totalWeight).toBeGreaterThan(0);
    expect(result.candidateMetadata.promoted).toBe(false);
    expect(result.routingChanged).toBe(false);
  }, 60000);

  it("stops on invalid dataset", async () => {
    const { tmpDir, datasetPath } = await writeDataset([
      buildRow({ observation: [1, 2, 3] }),
    ]);
    const result = await trainIronSupervisedPolicy({
      datasetPath,
      reportOutputPath: path.join(tmpDir, "report.json"),
      metadataOutputPath: path.join(tmpDir, "meta.json"),
      docOutputPath: path.join(tmpDir, "report.md"),
    });
    expect(result.trainingAllowed).toBe(false);
    expect(result.candidateMetadata).toBeNull();
    expect(result.promoted).toBe(false);
  });
});
