import { describe, expect, it } from "vitest";

import {
  STEP11_S02_ACCEPTED_NEIGHBOR,
  countAxisDifferences,
  parseSubBucketAxes,
} from "../discoverStableNeighborBuckets.js";

describe("S02 neighbor expansion", () => {
  it("keeps Step11 neighbor candidates to a single axis jump from the accepted anchor", () => {
    const anchor = parseSubBucketAxes(STEP11_S02_ACCEPTED_NEIGHBOR);
    const candidate = parseSubBucketAxes(
      "strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=OOP::call=small::repeat=repeated",
    );
    const diff = countAxisDifferences(anchor, candidate);
    expect(diff.count).toBe(1);
    expect(diff.differingAxis).toBe("positionBand");
  });
});
