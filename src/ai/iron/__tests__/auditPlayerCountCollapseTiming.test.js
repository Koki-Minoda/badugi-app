import { describe, expect, it } from "vitest";

import { summarizePlayerCountCollapseTiming } from "../auditPlayerCountCollapseTiming.js";

describe("Step44 player-count collapse timing audit", () => {
  it("summarizes broad 4way+ observations and absent exact branches", () => {
    const report = summarizePlayerCountCollapseTiming({
      arena: {
        maxHands: 100,
        results: [
          {
            variant: "S02",
            candidateBucketObservations: {
              "strongSDA5 CALL/FOLD/RAISE::pc=4way+": 5,
            },
          },
        ],
      },
    });

    expect(report.classification).toBe("NO_TARGET_COLLAPSE_TO_EXACT_PLAYERCOUNT");
    expect(report.rows.find((row) => row.timing.includes("playerCount=3"))?.count).toBe(0);
    expect(report.pc4wayShare).toBe(1);
  });
});
