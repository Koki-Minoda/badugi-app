import { describe, expect, it } from "vitest";

import { verifyStep56GovernanceFreezeSummary } from "../verifyStep56GovernanceFreeze.js";

describe("verifyStep56GovernanceFreezeSummary", () => {
  it("passes preview-only learning dashboard governance", () => {
    const report = verifyStep56GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.promoted).toBe(false);
    expect(report.networkTelemetry).toBe(false);
  });

  it("fails if backend telemetry is introduced", () => {
    const report = verifyStep56GovernanceFreezeSummary({ networkTelemetry: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("networkTelemetry");
  });
});
