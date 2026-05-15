import { describe, expect, it } from "vitest";

import { decideS02StackDepthExportability } from "../decideS02StackDepthExportability.js";

describe("decideS02StackDepthExportability", () => {
  it("keeps missing-depth stackDepth signals monitor-only", () => {
    const report = decideS02StackDepthExportability({
      stabilityReport: {
        rows: [
          {
            stackDepth: "shallow",
            sample: 0,
            invalid: 0,
            repairRate: 0,
            signFlipRate: 0,
            confidence: 0,
            meanDelta: 0,
            verdict: "NO_REPLAY_SIGNAL",
          },
          {
            stackDepth: "medium",
            sample: 20,
            invalid: 0,
            repairRate: 0,
            signFlipRate: 0,
            confidence: 0.8,
            meanDelta: 5,
            verdict: "STABLE_POSITIVE",
          },
        ],
      },
      consistencyReport: { consistency: "PARTIAL" },
    });

    expect(report.decision).toBe("MONITOR_ONLY");
    expect(report.reason).toContain("missing-engine-backed-depth");
    expect(report.datasetRowsChanged).toBe(false);
  });

  it("allows export candidate only when every depth clears thresholds", () => {
    const rows = ["shallow", "medium", "deep"].map((stackDepth) => ({
      stackDepth,
      sample: 20,
      invalid: 0,
      repairRate: 0,
      signFlipRate: 0,
      confidence: 0.8,
      meanDelta: 5,
      verdict: "STABLE_POSITIVE",
    }));
    const report = decideS02StackDepthExportability({
      stabilityReport: { rows },
      consistencyReport: { consistency: "CONSISTENT" },
    });

    expect(report.decision).toBe("EXPORTABLE_CANDIDATE");
  });
});
