import { describe, expect, it } from "vitest";

import {
  classifyStableNeighborContext,
  countAxisDifferences,
} from "../discoverStableNeighborBuckets.js";

describe("discoverStableNeighborBuckets", () => {
  it("classifies stable contexts into deterministic sub-buckets", () => {
    const classified = classifyStableNeighborContext({
      variantId: "D02",
      handClass: "strongA5",
      playerCount: 3,
      position: "button",
      facingAction: "raise",
      legalActions: [{ type: "FOLD" }, { type: "CALL", toCall: 20 }, { type: "RAISE", toCall: 20 }],
    });
    expect(classified.parentStableBucket).toBe("strongA5 second-pressure");
    expect(classified.subBucketId).toContain("pc=3way");
    expect(classified.subBucketId).toContain("repeat=repeated");
  });

  it("detects a one-axis neighbor without allowing multi-axis jumps", () => {
    const stable = {
      playerCountBand: "3way",
      positionBand: "button",
      toCallBand: "tiny",
      repeatedPressure: "repeated",
    };
    const neighbor = {
      playerCountBand: "3way",
      positionBand: "button",
      toCallBand: "tiny",
      repeatedPressure: "single",
    };
    const far = {
      playerCountBand: "4way+",
      positionBand: "OOP",
      toCallBand: "small",
      repeatedPressure: "single",
    };
    expect(countAxisDifferences(stable, neighbor)).toEqual({
      count: 1,
      differingAxis: "repeatedPressure",
    });
    expect(countAxisDifferences(stable, far).count).toBeGreaterThan(1);
  });
});
