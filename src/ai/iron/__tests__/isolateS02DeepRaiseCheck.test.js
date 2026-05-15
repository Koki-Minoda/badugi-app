import { describe, expect, it } from "vitest";

import { isolateS02DeepRaiseCheck } from "../isolateS02DeepRaiseCheck.js";

const forcedReplayReport = {
  depths: [
    {
      stackDepth: "deep",
      results: [
        { valid: true, forcedA: "RAISE", forcedB: "CHECK", delta: 20, repairUsed: false, sampleMeta: { handClass: "lowerMediumSDA5", position: "big-blind", pressureFamily: "none-pressure", drawRound: "draw-0", playerCount: 3, callBand: "small" } },
        { valid: true, forcedA: "RAISE", forcedB: "CHECK", delta: 0, repairUsed: false, sampleMeta: { handClass: "lowerMediumSDA5", position: "big-blind", pressureFamily: "none-pressure", drawRound: "draw-0", playerCount: 4, callBand: "small" } },
        { valid: true, forcedA: "CALL", forcedB: "FOLD", delta: -20, repairUsed: false, sampleMeta: { handClass: "lowerMediumSDA5" } },
      ],
    },
  ],
};

describe("isolateS02DeepRaiseCheck", () => {
  it("isolates deep RAISE vs CHECK by context axes without governance mutation", () => {
    const report = isolateS02DeepRaiseCheck({ forcedReplayReport });

    expect(report.target).toBe("deep RAISE vs CHECK");
    expect(report.rows[0]).toMatchObject({ axis: "overall", bucket: "deep RAISE vs CHECK", sampleCount: 2 });
    expect(report.rows.some((row) => row.bucket === "handClass=lowerMediumSDA5")).toBe(true);
    expect(report.rows.every((row) => Number.isFinite(row.entropyScore))).toBe(true);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
