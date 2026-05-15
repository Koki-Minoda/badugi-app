import { describe, expect, it } from "vitest";

import { summarizeDatasetConcentrationRisk } from "../refreshDatasetConcentrationRisk.js";

describe("dataset concentration risk refresh", () => {
  it("summarizes Step39 concentration from datasets", async () => {
    const report = await summarizeDatasetConcentrationRisk();

    expect(report.after.totalRows).toBeGreaterThan(report.before.totalRows);
    expect(report.d01Excluded).toBe(true);
    expect(report.riskLevel).toBe("LOW");
  });
});
