import { describe, expect, it } from "vitest";

import { verifyStep54GovernanceFreezeSummary } from "../verifyStep54GovernanceFreeze.js";

describe("verifyStep54GovernanceFreezeSummary", () => {
  it("passes local preview history governance", () => {
    const report = verifyStep54GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.promoted).toBe(false);
    expect(report.networkTelemetry).toBe(false);
  });

  it("fails when external analytics is enabled", () => {
    const report = verifyStep54GovernanceFreezeSummary({ externalAnalytics: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("externalAnalytics");
  });
});
