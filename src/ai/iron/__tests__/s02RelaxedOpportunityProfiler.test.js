import { describe, expect, it } from "vitest";

import { summarizeS02RelaxedOpportunityProfiles } from "../profileS02RelaxedOpportunity.js";

describe("S02 relaxed opportunity profiler", () => {
  it("counts funnel stages and mismatch reasons", () => {
    const summary = summarizeS02RelaxedOpportunityProfiles([
      {
        handClass: "strongSDA5",
        playerCountBand: "3way",
        positionBand: "IP",
        callBand: "small",
        pressureChain: "firstRaiseAfterCall",
        exactOpportunity: true,
        datasetActionLegal: true,
        mismatchReason: "EXACT_HIT",
      },
      {
        handClass: "strongSDA5",
        playerCountBand: "3way",
        positionBand: "IP",
        callBand: "small",
        pressureChain: "repeatedPressure",
        exactOpportunity: true,
        datasetActionLegal: false,
        mismatchReason: "DATASET_ACTION_NOT_LEGAL",
      },
      {
        handClass: "mediumSDA5",
        playerCountBand: "4way+",
        positionBand: "blind",
        callBand: "tiny",
        pressureChain: "repeatedPressure",
        exactOpportunity: false,
        datasetActionLegal: false,
        mismatchReason: "NO_STRONG_SDA5",
      },
    ]);

    expect(summary.totalS02Decisions).toBe(3);
    expect(summary.strongSDA5Decisions).toBe(2);
    expect(summary.playerCount3way).toBe(2);
    expect(summary.ipDecisions).toBe(2);
    expect(summary.smallCallDecisions).toBe(2);
    expect(summary.pressureChainMatch).toBe(3);
    expect(summary.exactOpportunities).toBe(2);
    expect(summary.datasetActionLegalCount).toBe(1);
    expect(summary.finalDatasetHits).toBe(1);
    expect(summary.mismatchReasons.EXACT_HIT).toBe(1);
    expect(summary.mismatchReasons.DATASET_ACTION_NOT_LEGAL).toBe(1);
    expect(summary.mismatchReasons.NO_STRONG_SDA5).toBe(1);
  });
});
