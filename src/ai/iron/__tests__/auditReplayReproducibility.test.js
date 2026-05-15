import { describe, expect, it } from "vitest";

import { auditReplayReproducibility } from "../auditReplayReproducibility.js";

describe("auditReplayReproducibility", () => {
  it("hashes replay samples deterministically and rejects no clean duplicates", () => {
    const report = auditReplayReproducibility({
      signals: [
        {
          signal: "S02 coverage-shadow stackDepth deep",
          deterministicReplay: true,
          invalidReplayCount: 0,
          illegal: 0,
          freeze: 0,
          replaySamples: [
            {
              sampleId: "sample-a",
              variant: "S02",
              stackDepth: "deep",
              drawRound: "draw-1",
              playerCount: "3way",
              pressureFamily: "bet-pressure",
              position: "button",
            },
            {
              sampleId: "sample-a",
              variant: "S02",
              stackDepth: "deep",
              drawRound: "draw-1",
              playerCount: "3way",
              pressureFamily: "bet-pressure",
              position: "button",
            },
          ],
        },
      ],
    });

    expect(report.deterministicReplay).toBe(true);
    expect(report.invalidReplayCount).toBe(0);
    expect(report.illegal).toBe(0);
    expect(report.freeze).toBe(0);
    expect(report.mismatchCount).toBe(0);
    expect(report.signals[0].hashes[0].hash).toBe(report.signals[0].hashes[1].hash);
  });
});
