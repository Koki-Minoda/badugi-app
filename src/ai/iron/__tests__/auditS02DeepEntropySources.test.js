import { describe, expect, it } from "vitest";

import { auditS02DeepEntropySources } from "../auditS02DeepEntropySources.js";

describe("auditS02DeepEntropySources", () => {
  it("reports dimension entropy for deep raise/check replay context", () => {
    const report = auditS02DeepEntropySources({
      forcedReplayReport: {
        depths: [
          {
            stackDepth: "deep",
            results: [
              { valid: true, forcedA: "RAISE", forcedB: "CHECK", sampleMeta: { position: "big-blind", pressureFamily: "none-pressure", drawRound: "draw-0", playerCount: 3, callBand: "small" } },
              { valid: true, forcedA: "RAISE", forcedB: "CHECK", sampleMeta: { position: "big-blind", pressureFamily: "none-pressure", drawRound: "draw-0", playerCount: 4, callBand: "small" } },
            ],
          },
        ],
      },
    });

    const playerCount = report.rows.find((row) => row.field === "playerCount");
    const position = report.rows.find((row) => row.field === "position");
    expect(playerCount.severity).toBe("HIGH_ENTROPY");
    expect(position.severity).toBe("LOW_ENTROPY");
    expect(report.datasetRowsChanged).toBe(false);
  });
});
