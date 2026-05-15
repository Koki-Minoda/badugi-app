import { describe, expect, it } from "vitest";

import { evaluateSourcePriorityFreezeDecision } from "../auditSourcePriorityFreezeDecision.js";

describe("evaluateSourcePriorityFreezeDecision", () => {
  it("recommends freeze when neutrality is complete", () => {
    const report = evaluateSourcePriorityFreezeDecision({
      sameActionRate: 1,
      differentActionRate: 0,
      meanEVDelta: 0,
      replayOutcomeChanged: 0,
      overrideWouldChangeGameplay: 0,
    });

    expect(report.freezeRecommended).toBe(true);
  });

  it("blocks freeze when action divergence exists", () => {
    const report = evaluateSourcePriorityFreezeDecision({
      sameActionRate: 0.98,
      differentActionRate: 0.02,
      meanEVDelta: 0,
      replayOutcomeChanged: 0,
      overrideWouldChangeGameplay: 0,
    });

    expect(report.freezeRecommended).toBe(false);
  });
});
