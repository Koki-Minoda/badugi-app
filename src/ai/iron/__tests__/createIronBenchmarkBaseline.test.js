import { describe, expect, it } from "vitest";

import { createIronBenchmarkBaseline } from "../createIronBenchmarkBaseline.js";

describe("createIronBenchmarkBaseline", () => {
  it("summarizes source types and variants", () => {
    const baseline = createIronBenchmarkBaseline({
      datasetPath: "/tmp/iron-step15.jsonl",
      datasetRows: [
        { variantId: "D02", bucket: "d02-parent", sourceType: "stable-bucket" },
        { variantId: "S01", bucket: "s01-parent", sourceType: "stable-bucket" },
        { variantId: "S02", bucket: "s02-neighbor", sourceType: "verified-neighbor-v2" },
        { variantId: "S02", bucket: "s02-relaxed", sourceType: "verified-relaxed-match" },
      ],
      priorityOrdering: [{ sourceType: "stable-bucket", priority: 0 }],
      deterministicReplay: true,
      outputPath: "/tmp/iron-step22-baseline.json",
    });

    expect(baseline.variants).toEqual(["D02", "S01", "S02"]);
    expect(baseline.stableBuckets).toBe(2);
    expect(baseline.verifiedNeighbors).toBe(1);
    expect(baseline.relaxedSources).toBe(1);
    expect(baseline.promotionEnabled).toBe(false);
  });
});
