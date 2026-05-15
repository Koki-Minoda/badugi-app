import { describe, expect, it } from "vitest";

import { isolateS02MediumSignFlip } from "../isolateS02MediumSignFlip.js";

const forcedReplayReport = {
  depths: [
    {
      stackDepth: "medium",
      results: [
        { valid: true, delta: 30, forcedA: "CALL", forcedB: "FOLD", sampleMeta: { pressureFamily: "bet-pressure", playerCount: 3, callBand: "small", drawRound: "draw-0", position: "button" } },
        { valid: true, delta: -10, forcedA: "CALL", forcedB: "FOLD", sampleMeta: { pressureFamily: "bet-pressure", playerCount: 3, callBand: "small", drawRound: "draw-0", position: "button" } },
        { valid: true, delta: 20, forcedA: "RAISE", forcedB: "FOLD", sampleMeta: { pressureFamily: "raise-pressure", playerCount: 4, callBand: "big", drawRound: "draw-1", position: "blind" } },
      ],
    },
  ],
};

describe("isolateS02MediumSignFlip", () => {
  it("groups medium forced replay sign flips by action and replay axes", () => {
    const report = isolateS02MediumSignFlip({ forcedReplayReport });

    expect(report.depth).toBe("medium");
    expect(report.overall.sample).toBe(3);
    expect(report.rows.some((row) => row.axis === "actionPair" && row.bucket === "CALL vs FOLD")).toBe(true);
    expect(report.rows.every((row) => ["LOW_FLIP", "MIXED", "HIGH_FLIP"].includes(row.verdict))).toBe(true);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
