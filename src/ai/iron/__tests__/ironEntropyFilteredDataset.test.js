import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadActionValueDataset } from "../loadActionValueDataset.js";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("iron entropy filtered dataset", () => {
  it("accepts Step14 isolated-row metadata while keeping promotion disabled", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iron-entropy-dataset-"));
    tempDirs.push(dir);
    const datasetPath = path.join(dir, "iron-step14-action-value.jsonl");
    const row = {
      variantId: "S02",
      schemaVersion: 1,
      observation: Array.from({ length: 96 }, () => 0),
      legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
      candidateActions: [
        { action: { type: "FOLD" }, source: "pro", estimatedValue: 0, sampleCount: 50, confidence: 1, verdict: "BAD" },
        { action: { type: "RAISE" }, source: "counterfactual", estimatedValue: 10, sampleCount: 50, confidence: 1, verdict: "GOOD" },
      ],
      chosenBestAction: { type: "RAISE" },
      handClass: "strongSDA5",
      bucket: "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated::position=button",
      sourceCorpusTag: "iron-step14",
      sourceCounterfactualScore: "/tmp/step14.json",
      trainingWeight: 1,
      sourceType: "verified-neighbor-v3-isolated",
      parentStableBucket: "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated",
      neighborAxis: "position",
      verificationConfidence: 1,
      repairApplied: true,
      repairType: "RAISE_TO_CALL",
      repairRate: 0.12,
      entropyScore: 0.08,
      isolationAxis: "position",
      metadata: {
        sampleTag: "iron-step14",
        counterfactualVerdict: "VERIFIED_EXPORTABLE",
        repairApplied: true,
        repairType: "RAISE_TO_CALL",
        safetyVerdict: "PASS",
      },
    };
    await fs.writeFile(datasetPath, `${JSON.stringify(row)}\n`, "utf8");
    const loaded = await loadActionValueDataset(datasetPath);
    expect(loaded.summary.validRows).toBe(1);
    expect(loaded.validRows[0].sourceType).toBe("verified-neighbor-v3-isolated");
    expect(loaded.validRows[0].entropyScore).toBe(0.08);
  });
});
