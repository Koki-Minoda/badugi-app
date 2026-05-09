import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { compareDivergenceCorpora } from "../compareDivergenceCorpora.js";
import { exportActionValueDataset } from "../exportActionValueDataset.js";
import { validateActionValueDataset } from "../validateActionValueDataset.js";

describe("action-value dataset export and validation", () => {
  it("exports replay-backed stable rows and validates them", async () => {
    await compareDivergenceCorpora({
      variants: ["D02", "S01", "S02"],
      maxSamples: 500,
      historicalTag: "step4w",
      freshTag: "step4w",
      postPatchTag: "step4x",
    });

    const exported = await exportActionValueDataset({
      variants: ["D02", "S01", "S02"],
      sampleTag: "step4w",
      confidenceThreshold: 0.7,
    });

    expect(typeof exported.outputPath).toBe("string");
    expect(exported.rowCount).toBeGreaterThan(0);

    const validation = await validateActionValueDataset({
      datasetPath: exported.outputPath,
    });

    expect(validation.total).toBeGreaterThan(0);
    expect(validation.invalid).toBe(0);
    expect(validation.trainingAllowed).toBe(true);
  }, 120000);

  it("rejects noisy or malformed rows", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mgx-action-value-"));
    const datasetPath = path.join(tmpDir, "invalid.jsonl");
    await fs.writeFile(
      datasetPath,
      `${JSON.stringify({
        variantId: "S02",
        schemaVersion: 1,
        observation: [1, 2, 3],
        legalActions: [{ type: "FOLD" }],
        candidateActions: [
          {
            action: { type: "CALL" },
            source: "standard",
            estimatedValue: 1,
            sampleCount: 10,
            confidence: 0.5,
            verdict: "NOISY",
          },
        ],
        chosenBestAction: { type: "CALL" },
        handClass: "strongSDA5",
        bucket: "strongSDA5 CALL/FOLD/RAISE",
        metadata: { seed: 1, handId: 1, step: 1, actorSeat: 0 },
      })}\n`,
      "utf8",
    );

    const validation = await validateActionValueDataset({ datasetPath, writeArtifacts: false });
    expect(validation.invalid).toBeGreaterThan(0);
    expect(validation.invalidReasons.observationShape).toBeGreaterThan(0);
    expect(validation.invalidReasons.candidateIllegal).toBeGreaterThan(0);
    expect(validation.invalidReasons.noisyCandidate).toBeGreaterThan(0);
    expect(validation.trainingAllowed).toBe(false);
  });
});
