import { describe, expect, it } from "vitest";

import { classifyS02RelaxedOpportunityDecision } from "../profileS02RelaxedOpportunity.js";

describe("replay-compatible player count classification", () => {
  it("can classify a 6-player live snapshot as 3way for opportunity matching only", () => {
    const snapshot = {
      players: Array.from({ length: 6 }, (_, seatIndex) => ({
        seatIndex,
        hand: ["Ah", "2h", "3h", "7h", "8h"],
        folded: false,
        hasFolded: false,
        allIn: false,
        isAllIn: false,
        betThisRound: seatIndex < 3 ? 20 : 0,
      })),
      currentBet: 20,
      dealerIndex: 0,
      metadata: { raiseCountThisRound: 1 },
    };
    const profile = classifyS02RelaxedOpportunityDecision({
      variantId: "S02",
      snapshot,
      seatIndex: 5,
      legalActions: ["FOLD", "CALL", "RAISE"],
      specializedRows: [],
      replayCompatibleMode: true,
    });

    expect(profile.playerCountArena).toBe(6);
    expect(profile.playerCountReconciled).toBe(3);
    expect(profile.playerCountBand).toBe("3way");
  });
});
