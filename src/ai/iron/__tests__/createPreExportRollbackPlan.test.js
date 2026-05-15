import { describe, expect, it } from "vitest";

import { createPreExportRollbackPlan } from "../createPreExportRollbackPlan.js";

describe("createPreExportRollbackPlan", () => {
  it("records that Step38 does not require rollback because it is preview-only", async () => {
    const plan = await createPreExportRollbackPlan({
      outputPath: "reports/ai-iron/test-preexport-rollback-plan-step38.json",
    });

    expect(plan.actualDatasetMutation).toBe(false);
    expect(plan.rollbackRequired).toBe(false);
    expect(plan.step39IfApproved).toContain("do not overwrite base");
  });
});
