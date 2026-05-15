import { describe, expect, it } from "vitest";
import { verifyStep50GovernanceFreezeSummary } from "../verifyStep50GovernanceFreeze.js";

describe("verifyStep50GovernanceFreezeSummary", () => {
  it("passes for preview-only coaching annotation", () => {
    expect(verifyStep50GovernanceFreezeSummary()).toMatchObject({
      status: "PASS",
      promoted: false,
      routingChanged: false,
      gameplayMutation: false,
      liveRLChanged: false,
    });
  });

  it("fails if forbidden mutation flags are set", () => {
    const report = verifyStep50GovernanceFreezeSummary({ routingChanged: true, syntheticReplay: true });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toEqual(expect.arrayContaining(["routingChanged", "syntheticReplay"]));
  });
});

