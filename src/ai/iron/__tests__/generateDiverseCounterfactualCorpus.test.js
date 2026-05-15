import { describe, expect, it } from "vitest";

import { generateDiverseCounterfactualCorpus } from "../generateDiverseCounterfactualCorpus.js";

describe("generate diverse counterfactual corpus plan", () => {
  it("prioritizes low-coverage replay dimensions without mutating gameplay or dataset state", () => {
    const report = generateDiverseCounterfactualCorpus({
      diversityReport: {
        dimensions: [
          { dimension: "pressureFamily", coverage: 0.33, entropy: 0.2 },
          { dimension: "playerCount", coverage: 1, entropy: 0.9 },
        ],
      },
      targetSamplesPerGap: 30,
    });

    expect(report.targets[0]).toMatchObject({
      dimension: "pressureFamily",
      priority: "HIGH",
      targetSamples: 30,
    });
    expect(report.deterministicReplayRequired).toBe(true);
    expect(report.gameplayMutation).toBe(false);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
