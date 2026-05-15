import { describe, expect, it } from "vitest";

import { summarizeTableSizeExposureMechanics } from "../auditTableSizeExposureMechanics.js";

describe("Step44 table-size exposure mechanics", () => {
  it("compares mixed 6max exposure with targeted repeatable exposure", () => {
    const report = summarizeTableSizeExposureMechanics({
      mixedArena: {
        results: [
          {
            variant: "S02",
            candidateBucketObservations: { "strongSDA5 CALL/FOLD/RAISE::pc=4way+": 3 },
          },
        ],
      },
      targetedSummary: { runs: [{}, {}], metrics: { exactOpportunities: { mean: 10 } } },
    });

    expect(report.rows.find((row) => row.tableType === "targeted 3way/4way exposure")?.exactOpportunities).toBe(20);
    expect(report.diagnosis).toContain("table-size exposure");
  });
});
