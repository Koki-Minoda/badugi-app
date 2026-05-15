import { describe, expect, it } from "vitest";

import { generateCoverageTargetedReplayCorpus } from "../generateCoverageTargetedReplayCorpus.js";

describe("generate coverage targeted replay corpus", () => {
  it("generates deterministic, legality-clean replay targets without governance mutation", () => {
    const first = generateCoverageTargetedReplayCorpus({ repeatsPerShape: 2 });
    const second = generateCoverageTargetedReplayCorpus({ repeatsPerShape: 2 });

    expect(first.samples).toHaveLength(14);
    expect(first.samples.map((sample) => sample.sampleId)).toEqual(second.samples.map((sample) => sample.sampleId));
    expect(first.samples.every((sample) => sample.deterministicReplay && sample.invalidReplayCount === 0 && sample.illegal === 0)).toBe(true);
    expect(first.datasetRowsChanged).toBe(false);
    expect(first.routingChanged).toBe(false);
    expect(first.gameplayMutation).toBe(false);
  });
});
