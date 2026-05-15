import { describe, expect, it } from "vitest";

import { isolateS02ActionPairs } from "../isolateS02ActionPairs.js";

describe("isolateS02ActionPairs", () => {
  it("separates forced replay results by action pair", () => {
    const report = isolateS02ActionPairs({
      forcedReplayReport: {
        depths: [
          {
            stackDepth: "medium",
            results: [
              { valid: true, forcedA: "CALL", forcedB: "FOLD", delta: 20, sampleMeta: { stackDepth: "medium" } },
              { valid: true, forcedA: "CALL", forcedB: "FOLD", delta: -10, sampleMeta: { stackDepth: "medium" } },
              { valid: true, forcedA: "RAISE", forcedB: "FOLD", delta: 50, sampleMeta: { stackDepth: "deep" } },
            ],
          },
        ],
      },
    });

    expect(report.pairs).toHaveLength(2);
    expect(report.pairs[0]).toMatchObject({ pair: "CALL vs FOLD", sample: 2 });
    expect(report.pairs.every((pair) => Number.isFinite(pair.entropy))).toBe(true);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
