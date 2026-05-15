import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadActionValueDataset } from "../loadActionValueDataset.js";
import { trainIronWarmStart } from "../trainIronWarmStart.js";

function buildValidRow(overrides = {}) {
  return {
    variantId: "D02",
    schemaVersion: 1,
    observation: new Array(96).fill(0),
    legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
    candidateActions: [
      {
        action: { type: "FOLD" },
        source: "pro",
        estimatedValue: 0,
        sampleCount: 10,
        confidence: 0.95,
        verdict: "BAD",
      },
      {
        action: { type: "RAISE" },
        source: "standard",
        estimatedValue: 100,
        sampleCount: 10,
        confidence: 0.95,
        verdict: "GOOD",
      },
    ],
    chosenBestAction: { type: "RAISE" },
    handClass: "strongA5",
    bucket: "strongA5 second-pressure",
    sourceCorpusTag: "step4y",
    sourceCounterfactualScore: "reports/ai-eval/counterfactual-score-d02-s01-s02-step4y.json",
    trainingWeight: 0.95,
    metadata: { seed: 1, handId: 1, step: 1, actorSeat: 0 },
    ...overrides,
  };
}

async function writeDataset(rows) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mgx-iron-"));
  const datasetPath = path.join(tmpDir, "dataset.jsonl");
  await fs.writeFile(datasetPath, rows.map((row) => JSON.stringify(row)).join("\n"), "utf8");
  return { tmpDir, datasetPath };
}

describe("Iron warm start bootstrap", () => {
  it("loads a valid dataset and emits sparse warnings", async () => {
    const { datasetPath } = await writeDataset([buildValidRow()]);
    const loaded = await loadActionValueDataset(datasetPath);
    expect(loaded.summary.totalRows).toBe(1);
    expect(loaded.summary.validRows).toBe(1);
    expect(loaded.summary.invalidRows).toBe(0);
    expect(loaded.warnings).toContain("sparse-dataset");
  });

  it("rejects malformed rows", async () => {
    const { datasetPath } = await writeDataset([
      buildValidRow({
        observation: [1, 2, 3],
        chosenBestAction: { type: "BET" },
      }),
    ]);
    const loaded = await loadActionValueDataset(datasetPath);
    expect(loaded.summary.validRows).toBe(0);
    expect(loaded.invalidRows.length).toBe(1);
  });

  it("stops candidate generation when trainingAllowed is false", async () => {
    const { tmpDir, datasetPath } = await writeDataset([
      buildValidRow({ candidateActions: [] }),
    ]);
    const modelRegistryPath = path.resolve("src/config/ai/modelRegistry.json");
    const beforeRegistry = await fs.readFile(modelRegistryPath, "utf8");
    const result = await trainIronWarmStart({
      datasetPath,
      reportOutputPath: path.join(tmpDir, "report.json"),
      metadataOutputPath: path.join(tmpDir, "meta.json"),
      docOutputPath: path.join(tmpDir, "report.md"),
    });
    const afterRegistry = await fs.readFile(modelRegistryPath, "utf8");
    expect(result.trainingAllowed).toBe(false);
    expect(result.promoted).toBe(false);
    expect(result.candidateMetadata).toBeNull();
    expect(result.warnings).toContain("training-gate-blocked");
    expect(beforeRegistry).toBe(afterRegistry);
  });

  it("generates candidate metadata for a valid dataset without promotion", async () => {
    const { tmpDir, datasetPath } = await writeDataset([
      buildValidRow(),
      buildValidRow({
        metadata: { seed: 2, handId: 2, step: 2, actorSeat: 1 },
      }),
    ]);
    const result = await trainIronWarmStart({
      datasetPath,
      reportOutputPath: path.join(tmpDir, "report.json"),
      metadataOutputPath: path.join(tmpDir, "meta.json"),
      docOutputPath: path.join(tmpDir, "report.md"),
    });
    expect(result.trainingAllowed).toBe(true);
    expect(result.promoted).toBe(false);
    expect(result.candidateMetadata?.promoted).toBe(false);
    expect(result.candidateMetadata?.eligibleForPromotion).toBe(false);
    expect(result.candidateMetadata?.candidateId).toMatch(/^iron-candidate-/);
  });
});
