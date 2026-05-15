import { describe, expect, it } from "vitest";

import { scoreCandidateRarity } from "../scoreCandidateRarity.js";

describe("score candidate rarity", () => {
  it("classifies viable, too rare, and shadow-only candidates", () => {
    const report = scoreCandidateRarity({
      candidates: [
        { candidate: "S02 strongSDA5 bet-pressure", frequency: 60, signFlipRate: 0.05, classification: "SAFE_CANDIDATE" },
        { candidate: "S01 rareSD27 raise-pressure", frequency: 4, signFlipRate: 0, classification: "COUNTERFACTUAL_ONLY" },
        {
          candidate: "D02 sparseA5 open-or-checkback",
          frequency: 20,
          signFlipRate: 0.05,
          replayScarcity: 0.9,
          classification: "COUNTERFACTUAL_ONLY",
        },
      ],
    });

    expect(report.candidates.map((entry) => entry.classification)).toEqual(["VIABLE", "TOO_RARE", "SHADOW_ONLY"]);
    expect(report.viableCount).toBe(1);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
