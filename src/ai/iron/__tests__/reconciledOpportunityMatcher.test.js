import { describe, expect, it } from "vitest";

import { buildBucketMatch } from "../ironCandidatePolicy.js";

function createSnapshot({ currentBet = 20, playerBet = 0, raiseCount = 0 } = {}) {
  return {
    currentBet,
    bigBlind: 20,
    drawRound: 1,
    dealerIndex: 0,
    players: [
      { folded: false, hasFolded: false, seatOut: false, sittingOut: false, betThisRound: 20, stack: 200, hand: ["KH", "QD", "9S", "8C", "2D"] },
      { folded: false, hasFolded: false, seatOut: false, sittingOut: false, betThisRound: 20, stack: 200, hand: ["7H", "6D", "5S", "4C", "AC"] },
      { folded: false, hasFolded: false, seatOut: false, sittingOut: false, betThisRound: playerBet, stack: 200, hand: ["7C", "6C", "5D", "4D", "AH"] },
      { folded: false, hasFolded: false, seatOut: false, sittingOut: false, betThisRound: 20, stack: 200, hand: ["KH", "QD", "JS", "TC", "9D"] },
      { folded: false, hasFolded: false, seatOut: false, sittingOut: false, betThisRound: 0, stack: 200, hand: ["KH", "QD", "JS", "TC", "9D"] },
      { folded: false, hasFolded: false, seatOut: false, sittingOut: false, betThisRound: 0, stack: 200, hand: ["KH", "QD", "JS", "TC", "9D"] },
    ],
    metadata: {
      currentBet,
      raiseCountThisRound: raiseCount,
      lastBettingAction: { type: "CALL" },
    },
  };
}

describe("reconciled opportunity matcher", () => {
  it("maps replay-compatible S02 spot to the step14 target bucket", () => {
    const bucket = buildBucketMatch({
      variantId: "S02",
      snapshot: createSnapshot(),
      seatIndex: 2,
      legalActions: ["FOLD", "CALL", "RAISE"],
      reconciliationOptions: {
        replayCompatiblePlayercount: true,
        replayCompatibleCallband: true,
        replayCompatiblePressurechain: true,
      },
    });
    expect(bucket?.bucket).toContain("pc=3way::pos=IP::call=small::repeat=repeated");
  });
});
