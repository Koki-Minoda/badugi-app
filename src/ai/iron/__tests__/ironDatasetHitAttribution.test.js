import { describe, expect, it } from "vitest";

import { analyzeIronDatasetHits } from "../analyzeIronDatasetHits.js";

describe("iron dataset hit attribution", () => {
  it("summarizes bucket hit attribution without mutating promotion state", () => {
    const report = analyzeIronDatasetHits({
      datasetPath: "data/ai/action-value/iron-step7-action-value.jsonl",
      results: [
        {
          variant: "D02",
          ironEv: 10.33,
          proEv: 6.69,
          standardEv: 8.29,
          datasetHitRate: 0.0042,
          proFallbackRate: 0.9958,
          ironEVWhenHit: 24.5,
          proFallbackEV: 10.1,
          hitHands: 6,
          fallbackOnlyHands: 294,
          bucketAttribution: [
            {
              bucket: "strongA5 second-pressure",
              hits: 6,
              handHits: 6,
              hitRate: 0.0042,
              ironEVWhenHit: 24.5,
              proFallbackEV: 10.1,
              impact: 14.4,
            },
          ],
        },
      ],
      promoted: false,
      routingChanged: false,
    });

    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.variants).toHaveLength(1);
    expect(report.variants[0].bucketAttribution[0].bucket).toBe("strongA5 second-pressure");
    expect(report.variants[0].bucketAttribution[0].impact).toBe(14.4);
  });
});
