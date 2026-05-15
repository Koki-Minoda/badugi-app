import { describe, expect, it } from "vitest";

import { createOfflineArenaDryRunPlan } from "../createOfflineArenaDryRunPlan.js";

describe("offline arena dry-run plan", () => {
  it("creates benchmark-only metadata with no promotion or routing mutation", () => {
    const plan = createOfflineArenaDryRunPlan({
      datasetPath: "data/ai/action-value/iron-step6-action-value.jsonl",
      qualityGate: {
        variantCoverage: { D01: 60, D02: 80, S01: 70, S02: 65 },
        minimumVariantsRequired: 4,
        maxSingleVariantShareAllowed: 0.45,
        singleVariantShare: 0.31,
        deterministicReplay: true,
        invalidReplayCount: 0,
        eligibleForOfflineArena: true,
      },
      rebalanceReport: {
        rows: 275,
        variantRows: [{ variant: "D01", rawRows: 60, rawShare: 0.22, rebalancedWeightShare: 0.24 }],
      },
    });

    expect(plan.eligibleForOfflineArena).toBe(true);
    expect(plan.eligibleForPromotion).toBe(false);
    expect(plan.promoted).toBe(false);
    expect(plan.routingChanged).toBe(false);
    expect(plan.noProductionRoutingMutation).toBe(true);
    expect(plan.noModelRegistryMutation).toBe(true);
  });
});

