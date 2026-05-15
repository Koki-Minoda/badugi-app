import { describe, expect, it } from "vitest";

import { buildS02RelaxedMatchProposal } from "../analyzeS02IsolatedBucketOpportunity.js";

describe("S02 relaxed match proposal", () => {
  it("proposes only replay-backed strongSDA5 pressure-chain relaxation", () => {
    const proposal = buildS02RelaxedMatchProposal();
    expect(proposal.candidates).toHaveLength(1);
    const candidate = proposal.candidates[0];
    expect(candidate.sourceType).toBe("verified-relaxed-match");
    expect(candidate.relaxedAxes).toEqual(["pressureChain"]);
    expect(candidate.relaxedAxisValues.pressureChain).toEqual(["firstRaiseAfterCall", "repeatedPressure"]);
    expect(candidate.excluded).toContain("weak/trash");
    expect(candidate.excluded).toContain("D01");
  });
});
