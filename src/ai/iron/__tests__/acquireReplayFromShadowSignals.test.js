import { describe, expect, it } from "vitest";

import { acquireReplayFromShadowSignals } from "../acquireReplayFromShadowSignals.js";
import { generateCoverageTargetedReplayCorpus } from "../generateCoverageTargetedReplayCorpus.js";

describe("acquireReplayFromShadowSignals", () => {
  it("turns monitor-only stackDepth shadows into clean deterministic replay samples", () => {
    const corpus = generateCoverageTargetedReplayCorpus({ repeatsPerShape: 2 });
    const report = acquireReplayFromShadowSignals({
      queue: [
        {
          candidate: "S02 coverage-shadow stackDepth shallow",
          variant: "S02",
          bucket: "coverage-shadow stackDepth shallow",
          status: "MONITOR_ONLY",
        },
      ],
      samples: corpus.samples,
    });

    expect(report.signalCount).toBe(1);
    expect(report.signals[0].replaySampleCount).toBeGreaterThan(0);
    expect(report.signals[0].stackDepthDistribution).toEqual([{ value: "shallow", count: report.signals[0].replaySampleCount }]);
    expect(report.deterministicReplay).toBe(true);
    expect(report.invalidReplayCount).toBe(0);
    expect(report.illegal).toBe(0);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
