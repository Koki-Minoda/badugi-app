import { describe, expect, it } from "vitest";

import { extractCoachingMaterialCandidateRows } from "../extractCoachingMaterialCandidates.js";

describe("extractCoachingMaterialCandidates", () => {
  it("extracts positive verified forced replay hit spots", () => {
    const candidates = extractCoachingMaterialCandidateRows({
      rows: [
        {
          sourceType: "verified-forced-replay",
          bucket: "S02 deep RAISE-vs-CHECK playerCount=3",
          playerCount: 3,
          chosenBestAction: "RAISE",
          rejectedAction: "CHECK",
          forcedReplay: { meanDelta: 32.2 },
        },
      ],
      arenas: [
        {
          results: [
            {
              variant: "S02",
              bucketHitDistribution: { "S02 deep RAISE-vs-CHECK playerCount=3": 2 },
              candidateBucketObservations: { "S02 deep RAISE-vs-CHECK playerCount=3": 2 },
            },
          ],
        },
      ],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].lessonTag).toBe("missed-value");
    expect(candidates[0].jpExplanationDraft).toContain("レイズ");
  });
});
