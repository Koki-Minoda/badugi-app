import { describe, expect, it } from "vitest";

import { bucketSpecificityScore } from "../scoreBucketSpecificity.js";

describe("bucketSpecificityScore", () => {
  it("scores isolated rows above relaxed rows", () => {
    const isolated = bucketSpecificityScore({
      sourceType: "verified-neighbor-v3-isolated",
      trainingWeight: 0.8,
      entropyScore: 0.08,
    });
    const relaxed = bucketSpecificityScore({
      sourceType: "verified-relaxed-match",
      trainingWeight: 1,
      entropyScore: 0.1,
    });
    expect(isolated.score).toBeGreaterThan(relaxed.score);
  });
});
