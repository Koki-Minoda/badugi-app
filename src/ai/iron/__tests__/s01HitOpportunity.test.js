import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeS01HitOpportunity } from "../analyzeS01HitOpportunity.js";

describe("S01 hit opportunity analysis", () => {
  it("summarizes exact bucket opportunities and fallback reasons", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "s01-hit-opportunity-"));
    const arenaPath = path.join(tempDir, "arena.json");
    const outputPath = path.join(tempDir, "s01.json");
    await fs.writeFile(
      arenaPath,
      JSON.stringify({
        arenaId: "iron-step11",
        results: [
          {
            variant: "S01",
            bucketHitDistribution: {
              "strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=repeated": 2,
            },
            candidateBucketObservations: {
              "strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=repeated": 5,
            },
            fallbackReasonByBucket: {
              "strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=repeated": {
                "bucket-mismatch": 2,
                "action-illegal": 1,
              },
            },
          },
        ],
      }),
      "utf8",
    );
    const result = await analyzeS01HitOpportunity({ arenaResultPath: arenaPath, outputPath });
    expect(result.exactHits).toBe(2);
    expect(result.opportunityCount).toBe(5);
    expect(result.bucketMismatch).toBe(2);
    expect(result.actionIllegal).toBe(1);
  });
});
