import { describe, expect, it } from "vitest";

import { decidePreExportApproval } from "../decidePreExportApproval.js";

describe("decidePreExportApproval", () => {
  it("approves Step39 export when validation, diff, rollback, and freeze gates pass", async () => {
    const decision = await decidePreExportApproval({
      validationReport: { status: "PASS" },
      diffPreviewReport: { highRiskFlags: [] },
      rollbackPlan: { actualDatasetMutation: false },
      governanceFreeze: {
        datasetRowsChanged: false,
        promoted: false,
        routingChanged: false,
        priorityFrozen: true,
        d01Excluded: true,
        gameplayMutation: false,
        sourcePriorityChanged: false,
      },
      outputPath: "reports/ai-iron/test-preexport-approval-step38.json",
    });

    expect(decision.approval).toBe("APPROVED_FOR_STEP39_EXPORT");
    expect(decision.reason).toEqual(["all-gates-pass"]);
  });

  it("holds when validation has not passed", async () => {
    const decision = await decidePreExportApproval({
      validationReport: { status: "WARN" },
      diffPreviewReport: { highRiskFlags: [] },
      rollbackPlan: { actualDatasetMutation: false },
      governanceFreeze: {
        datasetRowsChanged: false,
        promoted: false,
        routingChanged: false,
        priorityFrozen: true,
        d01Excluded: true,
        gameplayMutation: false,
        sourcePriorityChanged: false,
      },
      outputPath: "reports/ai-iron/test-preexport-approval-hold-step38.json",
    });

    expect(decision.approval).toBe("HOLD");
    expect(decision.reason).toContain("preexport-validation-not-pass");
  });
});
