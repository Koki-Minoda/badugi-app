import { describe, expect, it } from "vitest";

import { verifyStep57GovernanceFreezeSummary } from "../verifyStep57GovernanceFreeze.js";

describe("verifyStep57GovernanceFreezeSummary", () => {
  it("passes preview-only visual dashboard governance", () => {
    const report = verifyStep57GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.promoted).toBe(false);
    expect(report.networkTelemetry).toBe(false);
    expect(report.piiIncluded).toBe(false);
  });

  it("fails if external analytics is introduced", () => {
    const report = verifyStep57GovernanceFreezeSummary({ externalAnalytics: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("externalAnalytics");
  });
});
