import { describe, expect, it } from "vitest";

import { searchS02IsolatedSubBuckets } from "../searchS02IsolatedSubBuckets.js";
import { step28Rows } from "./s02CounterfactualFixtures.js";

describe("searchS02IsolatedSubBuckets", () => {
  it("finds exportable isolated sub-buckets when thresholds are met", () => {
    const report = searchS02IsolatedSubBuckets({ rows: step28Rows });

    expect(report.subBuckets[0]).toEqual(
      expect.objectContaining({ bucket: "playerCount=4way+", verdict: "EXPORTABLE_CANDIDATE" }),
    );
    expect(report.exportableCount).toBeGreaterThan(0);
  });
});
