import fs from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { writeS02RelaxedOpportunityArtifacts } from "../profileS02RelaxedOpportunity.js";

const OUTPUT_PATH = "reports/ai-iron/test-s02-relaxed-opportunity-profile.json";
const NEAR_MISS_PATH = "reports/ai-iron/test-s02-relaxed-near-miss.jsonl";

describe("S02 near miss trace", () => {
  afterEach(async () => {
    await fs.rm(OUTPUT_PATH, { force: true });
    await fs.rm(NEAR_MISS_PATH, { force: true });
  });

  it("writes summary and near miss traces without exact hits", async () => {
    await writeS02RelaxedOpportunityArtifacts({
      profiles: [
        {
          decisionId: "d1",
          handClass: "strongSDA5",
          playerCountBand: "3way",
          positionBand: "IP",
          callBand: "small",
          pressureChain: "firstRaiseAfterCall",
          exactOpportunity: true,
          datasetActionLegal: false,
          mismatchReason: "DATASET_ACTION_NOT_LEGAL",
        },
        {
          decisionId: "d2",
          handClass: "strongSDA5",
          playerCountBand: "3way",
          positionBand: "IP",
          callBand: "small",
          pressureChain: "repeatedPressure",
          exactOpportunity: true,
          datasetActionLegal: true,
          mismatchReason: "EXACT_HIT",
        },
      ],
      outputPath: OUTPUT_PATH,
      nearMissOutputPath: NEAR_MISS_PATH,
    });

    const summary = JSON.parse(await fs.readFile(OUTPUT_PATH, "utf8"));
    const nearMissLines = (await fs.readFile(NEAR_MISS_PATH, "utf8")).trim().split("\n");

    expect(summary.finalDatasetHits).toBe(1);
    expect(summary.exactOpportunities).toBe(2);
    expect(nearMissLines).toHaveLength(1);
    expect(JSON.parse(nearMissLines[0]).decisionId).toBe("d1");
  });
});
