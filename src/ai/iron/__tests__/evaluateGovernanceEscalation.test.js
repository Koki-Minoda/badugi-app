import { describe, expect, it } from "vitest";

import { evaluateGovernanceEscalation } from "../evaluateGovernanceEscalation.js";

describe("evaluateGovernanceEscalation", () => {
  it("keeps no-action for single sparse warn", () => {
    const report = evaluateGovernanceEscalation({ governanceHistory: [{ status: "WARN" }] });
    expect(report.governanceAction).toBe("NO_ACTION");
  });

  it("escalates on 3 consecutive fails", () => {
    const report = evaluateGovernanceEscalation({
      governanceHistory: [{ status: "FAIL" }, { status: "FAIL" }, { status: "FAIL" }],
    });
    expect(report.governanceAction).toBe("ESCALATE");
  });
});
