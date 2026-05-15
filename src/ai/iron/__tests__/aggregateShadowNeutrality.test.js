import { describe, expect, it } from "vitest";

import { aggregateShadowNeutrality } from "../aggregateShadowNeutrality.js";

describe("aggregateShadowNeutrality", () => {
  it("computes same-action summary", async () => {
    const summary = await aggregateShadowNeutrality({
      rows: [
        { sameAction: true, evDelta: 0, specificityDelta: 10 },
        { sameAction: true, evDelta: 0, specificityDelta: 11 },
      ],
      outputPath: "/tmp/step21-neutrality-summary.json",
    });
    expect(summary.sameActionRate).toBe(1);
    expect(summary.differentActionRate).toBe(0);
  });
});
