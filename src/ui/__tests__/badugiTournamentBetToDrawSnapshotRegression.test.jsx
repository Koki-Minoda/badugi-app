import { describe, expect, it } from "vitest";
import { classifyMobileWaitingFreeze } from "../qa/mobileFreezeDetector.js";
import { buildBadugiBetToDrawTransitionTrace } from "../../games/badugi/auditBadugiBetToDrawTransition.js";

describe("Badugi tournament BET to DRAW snapshot regression", () => {
  it("classifies waiting after a closed BET round as an invalid freeze state", () => {
    const classification = classifyMobileWaitingFreeze({
      waitingForOtherPlayers: true,
      resultVisible: false,
      nextHandVisible: false,
      handDisplay: "5/5",
      controller: {
        actorSeat: null,
        playersNeedingAction: [],
        shouldRoundClose: true,
        isTerminal: false,
      },
      players: [
        { seat: 0, folded: false, allIn: false, seatOut: false, stack: 934 },
        { seat: 1, folded: true, allIn: false, seatOut: false, stack: 0 },
        { seat: 2, folded: true, allIn: false, seatOut: false, stack: 0 },
      ],
    });

    expect(classification).toBe("WAITING_WITH_NO_PENDING_ACTORS");
  });

  it("detects stale BET UI after BET closure should enter DRAW", () => {
    const trace = buildBadugiBetToDrawTransitionTrace({
      before: {
        handId: "badugi-mobile-draw2",
        phase: "BET",
        drawRound: 2,
        betRound: 2,
        currentBet: 21,
        pot: 66,
        turn: null,
        nextTurn: null,
        players: [
          {
            seatIndex: 0,
            name: "Hero",
            folded: false,
            allIn: false,
            seatOut: false,
            stack: 934,
            betThisRound: 21,
            totalInvested: 66,
            hasActedThisRound: true,
          },
          {
            seatIndex: 1,
            name: "Folded",
            folded: true,
            hasFolded: true,
            allIn: false,
            stack: 0,
            betThisRound: 0,
            hasActedThisRound: true,
          },
        ],
      },
      after: {
        phase: "BET",
        drawRound: 2,
        pot: 66,
      },
      mode: "tournament",
      transitionCalled: false,
    });

    expect(trace.shouldCloseBetRound).toBe(true);
    expect(trace.expectedNextPhase).toBe("DRAW");
    expect(trace.actualNextPhase).toBe("BET");
    expect(trace.needsActionForBet).toBe(false);
  });
});
