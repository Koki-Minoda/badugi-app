import { describe, expect, it } from "vitest";

import { auditReplayDiversity } from "../auditReplayDiversity.js";

describe("audit replay diversity", () => {
  it("summarizes unique values, normalized entropy, and coverage by replay dimension", () => {
    const report = auditReplayDiversity({
      rows: [
        { variant: "S02", position: "button", playerCount: "heads-up", pressureFamily: "bet-pressure", stackDepth: "medium", drawRound: 1 },
        { variant: "S01", position: "blind", playerCount: "3way", pressureFamily: "raise-pressure", stackDepth: "short", drawRound: 2 },
        { variant: "S02", position: "button", playerCount: "heads-up", pressureFamily: "bet-pressure", stackDepth: "medium", drawRound: 1 },
      ],
    });

    expect(report.dimensions.find((entry) => entry.dimension === "variant")).toMatchObject({
      unique: 2,
      coverage: 0.6667,
    });
    expect(report.dimensions.find((entry) => entry.dimension === "pressureFamily")?.entropy).toBeGreaterThan(0);
    expect(report.datasetRowsChanged).toBe(false);
    expect(report.routingChanged).toBe(false);
  });
});
