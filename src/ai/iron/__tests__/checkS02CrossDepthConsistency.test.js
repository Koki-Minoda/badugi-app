import { describe, expect, it } from "vitest";

import { checkS02CrossDepthConsistency } from "../checkS02CrossDepthConsistency.js";

describe("checkS02CrossDepthConsistency", () => {
  it("returns partial when available depths agree but one depth has no signal", () => {
    const report = checkS02CrossDepthConsistency({
      stabilityReport: {
        rows: [
          { stackDepth: "shallow", valid: 0, meanDelta: 0 },
          { stackDepth: "medium", valid: 20, meanDelta: 5 },
          { stackDepth: "deep", valid: 20, meanDelta: 10 },
        ],
      },
    });

    expect(report.consistency).toBe("PARTIAL");
    expect(report.bestDepth).toBe("deep");
    expect(report.worstDepth).toBe("medium");
    expect(report.datasetRowsChanged).toBe(false);
  });

  it("returns inconsistent when directions disagree", () => {
    const report = checkS02CrossDepthConsistency({
      stabilityReport: {
        rows: [
          { stackDepth: "medium", valid: 20, meanDelta: 5 },
          { stackDepth: "deep", valid: 20, meanDelta: -1 },
        ],
      },
    });

    expect(report.consistency).toBe("INCONSISTENT");
  });
});
