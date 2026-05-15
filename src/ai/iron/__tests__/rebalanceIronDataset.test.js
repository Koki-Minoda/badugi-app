import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { rebalanceIronDataset } from "../rebalanceIronDataset.js";

function buildRow(variantId, bucket, trainingWeight = 1, index = 0) {
  return {
    variantId,
    schemaVersion: 1,
    observation: new Array(96).fill(0),
    legalActions: [{ type: "CALL" }, { type: "RAISE" }],
    candidateActions: [
      {
        action: { type: "RAISE" },
        source: "standard",
        estimatedValue: 10,
        sampleCount: 50,
        confidence: 1,
        verdict: "GOOD",
      },
    ],
    chosenBestAction: { type: "RAISE" },
    handClass: "test",
    bucket,
    sourceCorpusTag: "iron-step4",
    sourceCounterfactualScore: "reports/ai-eval/counterfactual-score-d02-s01-s02-d01-iron-step4.json",
    trainingWeight,
    metadata: { seed: 1, handId: index + 1, step: index + 1, actorSeat: 0 },
  };
}

describe("rebalanceIronDataset", () => {
  it("reduces D02 dominance in weight share", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mgx-rebalance-"));
    const datasetPath = path.join(tmpDir, "dataset.jsonl");
    const rows = [
      ...new Array(8).fill(null).map((_, index) => buildRow("D02", "strongA5 second-pressure", 1, index)),
      buildRow("S01", "strongSD27 top-end pressure", 1, 100),
      buildRow("S02", "strongSDA5 safe pressure", 1, 101),
    ];
    await fs.writeFile(datasetPath, rows.map((row) => JSON.stringify(row)).join("\n"), "utf8");
    const report = await rebalanceIronDataset({
      datasetPath,
      outputPath: path.join(tmpDir, "rebalance.json"),
    });
    const d02 = report.variantRows.find((row) => row.variant === "D02");
    expect(d02.rawShare).toBeGreaterThan(0.7);
    expect(d02.rebalancedWeightShare).toBeLessThan(d02.rawShare);
  });
});
