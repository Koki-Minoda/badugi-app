import { describe, expect, it } from "vitest";

import { summarizeForcedReplayHitPersistence } from "../auditForcedReplayHitPersistence.js";

function arena(hits3, hits4) {
  return {
    results: [
      {
        variant: "S02",
        bucketHitDistribution: {
          "S02 deep RAISE-vs-CHECK playerCount=3": hits3,
          "S02 deep RAISE-vs-CHECK playerCount=4": hits4,
        },
        candidateBucketObservations: {
          "S02 deep RAISE-vs-CHECK playerCount=3": hits3,
          "S02 deep RAISE-vs-CHECK playerCount=4": hits4,
        },
        ironProGap: 1,
      },
    ],
  };
}

describe("forced replay hit persistence", () => {
  it("requires playerCount 3 and 4 hits in every run", () => {
    const report = summarizeForcedReplayHitPersistence({ arenas: [arena(2, 1), arena(3, 4)] });
    expect(report.allPlayerCountsPersistent).toBe(true);
    expect(report.playerCounts.find((entry) => entry.playerCount === 3).hits).toBe(5);
  });

  it("flags missing branch hits", () => {
    const report = summarizeForcedReplayHitPersistence({ arenas: [arena(2, 0), arena(3, 4)] });
    expect(report.allPlayerCountsPersistent).toBe(false);
  });
});
