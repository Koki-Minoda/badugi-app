import { describe, expect, it } from "vitest";
import { verifyStep51GovernanceFreezeSummary } from "../verifyStep51GovernanceFreeze.js";

describe("verifyStep51GovernanceFreezeSummary", () => {
  it("passes the preview-only governance freeze", () => {
    const report = verifyStep51GovernanceFreezeSummary();
    expect(report.status).toBe("PASS");
    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.d01Excluded).toBe(true);
  });

  it("fails on production routing mutation", () => {
    const report = verifyStep51GovernanceFreezeSummary({ productionRoutingChanged: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("productionRoutingChanged");
  });
});
