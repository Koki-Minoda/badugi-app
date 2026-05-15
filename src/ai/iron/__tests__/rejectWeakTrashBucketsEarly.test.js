import { describe, expect, it } from "vitest";

import { rejectWeakTrashBucketsEarly } from "../rejectWeakTrashBucketsEarly.js";

describe("reject weak/trash buckets early", () => {
  it("rejects weak, trash, high entropy, high repair, high signFlip, and monitor-only buckets", () => {
    const report = rejectWeakTrashBucketsEarly({
      candidates: [
        { variant: "S02", bucketFamily: "weakSDA5 bet-pressure" },
        { variant: "D02", bucketFamily: "trashA5 FOLD/CALL verify" },
        { variant: "S01", bucketFamily: "strongSD27 bet-pressure", entropyScore: 0.8 },
        { variant: "S02", bucketFamily: "strongSDA5 raise-pressure", repairRate: 0.2 },
        { variant: "S02", bucketFamily: "lowerMediumSDA5 bet-pressure", priority: "P3_MONITOR_ONLY" },
        { variant: "S02", bucketFamily: "strongSDA5 bet-pressure", signFlipRate: 0.05 },
      ],
    });

    expect(report.rejectedCount).toBe(5);
    expect(report.acceptedCount).toBe(1);
    expect(report.rejected.flatMap((entry) => entry.rejectReason)).toContain("monitor-only");
    expect(report.routingChanged).toBe(false);
  });
});
