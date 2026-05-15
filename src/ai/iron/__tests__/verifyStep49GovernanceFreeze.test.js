import { describe, expect, it } from "vitest";
import { verifyStep49GovernanceFreezeSummary } from "../verifyStep49GovernanceFreeze.js";

describe("verifyStep49GovernanceFreezeSummary", () => {
  it("passes when Step49 remains preview-only", () => {
    expect(verifyStep49GovernanceFreezeSummary()).toMatchObject({
      status: "PASS",
      promoted: false,
      routingChanged: false,
      priorityFrozen: true,
      d01Excluded: true,
      liveRLChanged: false,
    });
  });

  it("fails on production mutation signals", () => {
    const report = verifyStep49GovernanceFreezeSummary({ promoted: true, liveRLChanged: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toEqual(expect.arrayContaining(["promoted", "liveRLChanged"]));
  });
});

