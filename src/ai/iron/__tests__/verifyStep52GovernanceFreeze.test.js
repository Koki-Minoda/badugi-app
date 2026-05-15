import { describe, expect, it } from "vitest";
import { verifyStep52GovernanceFreezeSummary } from "../verifyStep52GovernanceFreeze.js";

describe("verifyStep52GovernanceFreezeSummary", () => {
  it("passes preview-only telemetry governance", () => {
    const report = verifyStep52GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.externalAnalyticsSdk).toBe(false);
    expect(report.networkDependency).toBe(false);
    expect(report.liveRLMutation).toBe(false);
  });

  it("fails if hidden telemetry is enabled", () => {
    const report = verifyStep52GovernanceFreezeSummary({ hiddenTelemetry: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("hiddenTelemetry");
  });
});
