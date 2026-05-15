import { describe, expect, it } from "vitest";

import { summarizeS02RelaxedOpportunityProfiles } from "../profileS02RelaxedOpportunity.js";

describe("S02 playerCount opportunity profiler", () => {
  it("summarizes strongSDA5 decisions by player count context", () => {
    const summary = summarizeS02RelaxedOpportunityProfiles([
      {
        handClass: "strongSDA5",
        playerCountBand: "HU",
        activePlayersAtHandStart: 6,
        activePlayersAtDecision: 2,
        effectivePlayerCount: 2,
        potContributorsCount: 2,
        bettingParticipantsCount: 2,
        playerCountTransition: "collapsed-6-to-2",
        positionBand: "IP",
        callBand: "small",
        pressureChain: "firstRaiseAfterCall",
        exactOpportunity: false,
        datasetActionLegal: false,
        mismatchReason: "PLAYERCOUNT_MISMATCH",
      },
      {
        handClass: "strongSDA5",
        playerCountBand: "4way+",
        activePlayersAtHandStart: 6,
        activePlayersAtDecision: 4,
        effectivePlayerCount: 4,
        potContributorsCount: 3,
        bettingParticipantsCount: 3,
        playerCountTransition: "collapsed-6-to-4",
        positionBand: "IP",
        callBand: "small",
        pressureChain: "repeatedPressure",
        exactOpportunity: false,
        datasetActionLegal: false,
        mismatchReason: "PLAYERCOUNT_MISMATCH",
      },
    ]);

    expect(summary.strongSDA5Decisions).toBe(2);
    expect(summary.strongSDA5ByPlayerCount.HU).toBe(1);
    expect(summary.strongSDA5ByPlayerCount["4way+"]).toBe(1);
    expect(summary.playerCountTransitions["collapsed-6-to-2"]).toBe(1);
    expect(summary.playerCountTransitions["collapsed-6-to-4"]).toBe(1);
    expect(summary.activePlayersAtDecision["2"]).toBe(1);
    expect(summary.activePlayersAtDecision["4"]).toBe(1);
  });
});
