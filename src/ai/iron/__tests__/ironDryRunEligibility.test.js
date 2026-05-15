import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkIronDryRunEligibility } from "../checkIronDryRunEligibility.js";

const tempDirs = [];

function buildRow({
  variantId = "D02",
  bucket = "strongA5 second-pressure",
  chosenType = "RAISE",
  seed = 1,
  handId = 1,
  step = 1,
  actorSeat = 0,
} = {}) {
  return {
    variantId,
    schemaVersion: 1,
    observation: Array.from({ length: 96 }, () => 0),
    legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }],
    candidateActions: [
      {
        action: { type: "FOLD" },
        source: "pro",
        estimatedValue: 0,
        sampleCount: 50,
        confidence: 1,
        verdict: "BAD",
      },
      {
        action: { type: chosenType },
        source: "standard",
        estimatedValue: 10,
        sampleCount: 50,
        confidence: 1,
        verdict: "GOOD",
      },
    ],
    chosenBestAction: { type: chosenType },
    handClass: variantId === "D02" ? "strongA5" : variantId === "S01" ? "strongSD27" : "strongSDA5",
    bucket,
    sourceCorpusTag: "iron-step7",
    sourceCounterfactualScore: "/tmp/counterfactual.json",
    trainingWeight: 1,
    metadata: { seed, handId, step, actorSeat, counterfactualVerdict: "STABLE_STANDARD_BETTER" },
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("iron dry-run eligibility", () => {
  it("passes 3-variant dry-run gate and keeps 4-variant gate false", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iron-dryrun-"));
    tempDirs.push(dir);
    const datasetPath = path.join(dir, "iron-step7-action-value.jsonl");
    await fs.writeFile(
      datasetPath,
      [
        buildRow({ variantId: "D02", bucket: "strongA5 second-pressure", seed: 1, handId: 1 }),
        buildRow({ variantId: "S01", bucket: "strongSD27 top-end pressure", chosenType: "CALL", seed: 2, handId: 2 }),
        buildRow({ variantId: "S02", bucket: "strongSDA5 CALL/FOLD/RAISE", seed: 3, handId: 3 }),
      ]
        .map((row) => JSON.stringify(row))
        .join("\n"),
      "utf8",
    );
    await fs.mkdir(path.resolve("reports/ai-eval"), { recursive: true });
    await fs.writeFile(
      path.resolve("reports/ai-eval/replay-determinism-audit-iron-step7.json"),
      JSON.stringify({ deterministic: true }, null, 2),
      "utf8",
    );

    const result = await checkIronDryRunEligibility({ datasetPath, outputPath: path.join(dir, "eligibility.json") });
    expect(result.okForThreeVariantDryRun).toBe(true);
    expect(result.okForFourVariantIronCandidate).toBe(false);
    expect(result.eligibleForPromotion).toBe(false);
    expect(result.routingChanged).toBe(false);
    expect(result.reasonD01Excluded).toContain("no STABLE_STANDARD_BETTER");
  });
});
