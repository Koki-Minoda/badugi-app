import { describe, expect, it } from "vitest";

import {
  STEP12_S02_ACCEPTED_NEIGHBOR,
  countAxisDifferences,
  parseSubBucketAxes,
} from "../discoverStableNeighborBuckets.js";

describe("S02 neighbor v3 expansion", () => {
  it("keeps Step12 candidates to a single axis jump from the accepted v2 anchor", () => {
    const anchor = parseSubBucketAxes(STEP12_S02_ACCEPTED_NEIGHBOR);
    const candidate = parseSubBucketAxes(
      "strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=button::call=small::repeat=repeated",
    );
    const diff = countAxisDifferences(anchor, candidate);
    expect(diff.count).toBe(1);
    expect(diff.differingAxis).toBe("positionBand");
  });
});
