import { describe, expect, it } from "vitest";

import { summarizeNaturalTableDistribution } from "../validateNaturalTableDistribution.js";

describe("validateNaturalTableDistribution", () => {
  it("passes when observed shares match natural exposure config", () => {
    const report = summarizeNaturalTableDistribution({
      config: { tableSizeWeights: { "6max": 0.5, "4max": 0.25, "3way": 0.25 } },
      arena: {
        results: [
          { tableSizeHandDistribution: { "6max": 6, "4max": 3, "3way": 3 } },
          { tableSizeHandDistribution: { "6max": 6, "4max": 3, "3way": 3 } },
        ],
      },
    });
    expect(report.status).toBe("PASS");
    expect(report.observed).toEqual({ "6max": 0.5, "4max": 0.25, "3way": 0.25 });
  });
});
