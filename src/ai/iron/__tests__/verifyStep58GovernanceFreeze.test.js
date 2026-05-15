import { describe, expect, it } from "vitest";

import { verifyStep58GovernanceFreezeSummary } from "../verifyStep58GovernanceFreeze.js";

describe("verifyStep58GovernanceFreezeSummary", () => {
  it("passes preview deployment governance freeze", () => {
    const report = verifyStep58GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.promoted).toBe(false);
    expect(report.externalAnalytics).toBe(false);
  });

  it("fails if live RL mutation is introduced", () => {
    const report = verifyStep58GovernanceFreezeSummary({ liveRLMutation: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("liveRLMutation");
  });
});
