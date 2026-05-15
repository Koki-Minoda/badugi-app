import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadActionValueDataset } from "../loadActionValueDataset.js";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("iron repaired action dataset", () => {
  it("accepts repaired-row metadata without promotion semantics", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iron-repaired-dataset-"));
    tempDirs.push(dir);
    const datasetPath = path.join(dir, "iron-step13-action-value.jsonl");
    const row = {
      variantId: "S02",
      schemaVersion: 1,
      observation: Array.from({ length: 96 }, () => 0),
      legalActions: [{ type: "FOLD" }, { type: "CALL" }],
      candidateActions: [
        { action: { type: "FOLD" }, source: "pro", estimatedValue: 0, sampleCount: 82, confidence: 1, verdict: "BAD" },
        { action: { type: "CALL" }, source: "counterfactual", estimatedValue: 10, sampleCount: 82, confidence: 1, verdict: "GOOD" },
      ],
      chosenBestAction: { type: "CALL" },
      handClass: "strongSDA5",
      bucket: "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated",
      sourceCorpusTag: "iron-step13",
      sourceCounterfactualScore: "/tmp/report.json",
      trainingWeight: 1,
      sourceType: "verified-neighbor-v3-repaired",
      parentStableBucket: "strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=IP::call=small::repeat=repeated",
      neighborAxis: "playerCountBand",
      verificationConfidence: 1,
      repairApplied: true,
      repairType: "RAISE_TO_CALL",
      repairRate: 0.22,
      metadata: {
        seed: 1,
        handId: 2,
        step: 3,
        actorSeat: 0,
        counterfactualVerdict: "VERIFIED_WITH_REPAIR",
        repairApplied: true,
        repairType: "RAISE_TO_CALL",
      },
    };
    await fs.writeFile(datasetPath, `${JSON.stringify(row)}\n`, "utf8");
    const loaded = await loadActionValueDataset(datasetPath);
    expect(loaded.summary.validRows).toBe(1);
    expect(loaded.validRows[0].repairApplied).toBe(true);
    expect(loaded.validRows[0].repairType).toBe("RAISE_TO_CALL");
  });
});
