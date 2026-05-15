import { describe, expect, it } from "vitest";

import { verifyStep53GovernanceFreezeSummary } from "../verifyStep53GovernanceFreeze.js";

describe("verifyStep53GovernanceFreezeSummary", () => {
  it("passes preview-only summary governance", () => {
    const report = verifyStep53GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.promoted).toBe(false);
    expect(report.externalAnalytics).toBe(false);
    expect(report.networkTelemetry).toBe(false);
  });

  it("fails on live RL mutation", () => {
    const report = verifyStep53GovernanceFreezeSummary({ liveRLMutation: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("liveRLMutation");
  });
});
