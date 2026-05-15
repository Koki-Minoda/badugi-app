import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeS01OpportunitySampling } from "../analyzeS01OpportunitySampling.js";

describe("S01 opportunity sampling analysis", () => {
  it("classifies nearby bucket observations by axis mismatch", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "s01-opportunity-sampling-"));
    const arenaPath = path.join(tempDir, "arena.json");
    const outputPath = path.join(tempDir, "s01.json");
    await fs.writeFile(
      arenaPath,
      JSON.stringify({
        arenaId: "iron-step12",
        results: [
          {
            variant: "S01",
            bucketHitDistribution: {},
            candidateBucketObservations: {
              "strongSD27 top-end pressure::pc=3way::pos=IP::call=small::repeat=repeated": 3,
              "strongSD27 top-end pressure::pc=HU::pos=button::call=small::repeat=repeated": 2,
              "strongSD27 top-end pressure::pc=3way::pos=button::call=tiny::repeat=repeated": 4,
              "strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=single": 5,
            },
            fallbackReasonByBucket: {},
          },
        ],
      }),
      "utf8",
    );
    const result = await analyzeS01OpportunitySampling({ arenaResultPath: arenaPath, outputPath });
    expect(result.positionMismatch).toBe(3);
    expect(result.playerCountMismatch).toBe(2);
    expect(result.callBandMismatch).toBe(4);
    expect(result.repeatFlagMismatch).toBe(5);
  });
});
