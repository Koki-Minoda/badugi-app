import { describe, expect, it } from "vitest";

import { acquireS02DeepPlayerCountReplay } from "../acquireS02DeepPlayerCountReplay.js";
import { replayS02DeepPlayerCountBranches } from "../replayS02DeepPlayerCountBranches.js";
import { writeS02DeepBranchConfidenceAudit } from "../auditS02DeepBranchConfidence.js";
import { writeS02DeepAggregateStabilityRecheck } from "../recheckS02DeepAggregateStability.js";
import {
  redecideS02DeepExportGovernance,
  writeS02DeepExportGovernanceRedecision,
} from "../redecideS02DeepExportGovernance.js";
import { writeGovernanceFreezeVerificationStep37 } from "../verifyGovernanceFreezeStep37.js";
import { writeReplayDeterminismAuditStep37 } from "../writeReplayDeterminismAuditStep37.js";

async function withSuppressedDeckLogs(callback) {
  const originalLog = console.log;
  console.log = (...args) => {
    if (String(args[0] ?? "").includes("[DECK][STATE]")) return;
    originalLog(...args);
  };
  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}

describe("replayS02DeepPlayerCountBranches", () => {
  it("runs a small engine-backed replay for playerCount branches", async () => {
    const report = await withSuppressedDeckLogs(() =>
      replayS02DeepPlayerCountBranches({
        targetPerBranch: 1,
        outputPath: "reports/ai-iron/test-s02-deep-playercount-forced-replay-step37.json",
      }),
    );

    expect(report.branches).toHaveLength(2);
    expect(report.branches.every((branch) => branch.sampleCount === 1)).toBe(true);
    expect(report.datasetRowsChanged).toBe(false);
  }, 120000);

  const maybeIt = process.env.MGX_IRON_STEP37_WRITE_REPORTS === "1" ? it : it.skip;
  maybeIt("writes Step37 playerCount branch replay reports", async () => {
    await acquireS02DeepPlayerCountReplay({ targetPerBranch: 50 });
    const forcedReplayReport = await withSuppressedDeckLogs(() =>
      replayS02DeepPlayerCountBranches({
        targetPerBranch: 50,
      }),
    );
    const branchReport = await writeS02DeepBranchConfidenceAudit({ forcedReplayReport });
    const aggregateReport = await writeS02DeepAggregateStabilityRecheck({ forcedReplayReport });
    await writeReplayDeterminismAuditStep37({ forcedReplayReport });
    await writeS02DeepExportGovernanceRedecision({ branchReport, aggregateReport, forcedReplayReport });
    await writeGovernanceFreezeVerificationStep37();

    expect(forcedReplayReport.branches.every((branch) => branch.sampleCount >= 50)).toBe(true);
    expect(["SAFE_TO_EXPORT_NEXT", "COUNTERFACTUAL_ONLY", "MONITOR_ONLY", "DO_NOT_EXPORT"]).toContain(
      redecideS02DeepExportGovernance({
        branchReport,
        aggregateReport,
        forcedReplayReport,
      }).decision,
    );
  }, 900000);
});
