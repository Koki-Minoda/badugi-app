import { describe, expect, it } from "vitest";

import { buildStep58DeployReadinessChecklistSummary } from "../buildStep58DeployReadinessChecklist.js";

describe("buildStep58DeployReadinessChecklistSummary", () => {
  it("marks preview deploy ready when all gates pass", () => {
    const report = buildStep58DeployReadinessChecklistSummary();
    expect(report.deployReadiness).toBe("READY_FOR_PREVIEW_DEPLOY");
    expect(report.noProductionRollout).toBe(true);
  });

  it("holds deploy when any gate fails", () => {
    const report = buildStep58DeployReadinessChecklistSummary({ tests: "FAIL" });
    expect(report.deployReadiness).toBe("HOLD");
    expect(report.failures).toContain("required build and safety tests");
  });
});
