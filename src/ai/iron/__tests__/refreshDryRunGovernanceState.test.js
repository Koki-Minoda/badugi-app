import { describe, expect, it } from "vitest";

import { summarizeDryRunGovernanceState } from "../refreshDryRunGovernanceState.js";

describe("summarizeDryRunGovernanceState", () => {
  it("keeps dry-run governance frozen", () => {
    const report = summarizeDryRunGovernanceState({
      dryRunGate: { datasetPath: "data/ai/action-value/iron-step39-action-value.jsonl", okForThreeVariantDryRun: true },
    });

    expect(report.okForThreeVariantDryRun).toBe(true);
    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.priorityFrozen).toBe(true);
    expect(report.d01Excluded).toBe(true);
  });
});
