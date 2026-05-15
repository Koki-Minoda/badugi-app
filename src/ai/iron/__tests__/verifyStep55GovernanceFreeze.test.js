import { describe, expect, it } from "vitest";

import { verifyStep55GovernanceFreezeSummary } from "../verifyStep55GovernanceFreeze.js";

describe("verifyStep55GovernanceFreezeSummary", () => {
  it("passes preview-only variant recap governance", () => {
    const report = verifyStep55GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.promoted).toBe(false);
    expect(report.networkTelemetry).toBe(false);
    expect(report.piiIncluded).toBe(false);
  });

  it("fails if hidden telemetry is enabled", () => {
    const report = verifyStep55GovernanceFreezeSummary({ hiddenTelemetry: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("hiddenTelemetry");
  });
});
