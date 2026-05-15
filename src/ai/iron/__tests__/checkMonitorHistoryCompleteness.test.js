import { describe, expect, it } from "vitest";

import { checkMonitorHistoryCompleteness } from "../checkMonitorHistoryCompleteness.js";

function completeRun(index = 0) {
  return {
    runId: `run-${index}`,
    rawStatus: "WARN",
    hardenedStatus: "PASS",
    datasetHitRate: 0.001,
    ironProGap: { D02: 1, S01: 0, S02: 0.5 },
    deterministicReplay: true,
    promoted: false,
    routingChanged: false,
  };
}

describe("checkMonitorHistoryCompleteness", () => {
  it("passes when at least five completed runs are present", () => {
    const report = checkMonitorHistoryCompleteness({
      history: Array.from({ length: 5 }, (_value, index) => completeRun(index)),
    });

    expect(report.status).toBe("PASS");
    expect(report.completedRuns).toBe(5);
    expect(report.checks.noPromotedOrRoutingChangedRun).toBe(true);
  });

  it("fails when a completed run changed routing or promotion state", () => {
    const history = Array.from({ length: 5 }, (_value, index) => completeRun(index));
    history[4] = { ...history[4], routingChanged: true };

    const report = checkMonitorHistoryCompleteness({ history });

    expect(report.status).toBe("FAIL");
    expect(report.promotedOrRoutingChangedRuns).toHaveLength(1);
  });
});
