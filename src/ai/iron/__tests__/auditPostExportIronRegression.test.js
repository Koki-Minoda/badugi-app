import { describe, expect, it } from "vitest";

import { summarizePostExportIronRegression } from "../auditPostExportIronRegression.js";

describe("summarizePostExportIronRegression", () => {
  it("passes when there is no catastrophic regression or safety failure", () => {
    const report = summarizePostExportIronRegression({
      arenaId: "iron-step40",
      results: [
        { variant: "D02", ironEv: 10, proEv: 8, standardEv: 6, ironProGap: 2, ironStandardGap: 4, illegal: 0, freeze: 0 },
        { variant: "S02", ironEv: -5, proEv: 5, standardEv: 3, ironProGap: -10, ironStandardGap: -8, illegal: 0, freeze: 0 },
      ],
    });

    expect(report.status).toBe("PASS");
    expect(report.illegal).toBe(0);
    expect(report.freeze).toBe(0);
  });

  it("fails on illegal actions", () => {
    const report = summarizePostExportIronRegression({
      results: [{ variant: "S02", ironProGap: 1, illegal: 1, freeze: 0 }],
    });

    expect(report.status).toBe("FAIL");
    expect(report.reason).toContain("illegal-action-present");
  });
});
