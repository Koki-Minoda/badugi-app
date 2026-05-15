import { describe, expect, it } from "vitest";

import { auditS02RepairDependency } from "../auditS02RepairDependency.js";
import { focusedReportFixture } from "./s02CounterfactualFixtures.js";

describe("auditS02RepairDependency", () => {
  it("marks clean replay observations as safe", () => {
    const report = auditS02RepairDependency({ focusedReport: focusedReportFixture });

    expect(report.repairRate).toBe(0);
    expect(report.verdict).toBe("SAFE");
    expect(report.repairTypeBreakdown).toEqual({});
  });
});
