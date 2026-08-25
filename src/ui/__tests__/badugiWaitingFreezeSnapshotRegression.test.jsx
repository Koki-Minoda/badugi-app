import { describe, expect, it } from "vitest";
import { classifyMobileWaitingFreeze } from "../qa/mobileFreezeDetector.js";

describe("Badugi physical mobile waiting freeze snapshot regression", () => {
  it("classifies waiting with no pending actor as a freeze candidate", () => {
    const classification = classifyMobileWaitingFreeze({
      waitingForOtherPlayers: true,
      handDisplay: "5/5",
      controller: {
        actorSeat: null,
        playersNeedingAction: [],
        shouldRoundClose: true,
      },
      players: [
        { seat: 0, folded: false, allIn: false, seatOut: false, stack: 934 },
        { seat: 1, folded: true, allIn: false, seatOut: false, stack: 0 },
      ],
    });

    expect(classification).toBe("WAITING_WITH_NO_PENDING_ACTORS");
  });

  it("classifies waiting on an ineligible actor instead of treating it as valid CPU wait", () => {
    const classification = classifyMobileWaitingFreeze({
      waitingForOtherPlayers: true,
      controller: {
        actorSeat: 3,
        playersNeedingAction: [3],
        shouldRoundClose: false,
      },
      players: [
        { seat: 0, folded: false, allIn: false, seatOut: false, stack: 900 },
        { seat: 1, folded: false, allIn: false, seatOut: false, stack: 400 },
        { seat: 2, folded: false, allIn: false, seatOut: false, stack: 400 },
        { seat: 3, folded: true, allIn: false, seatOut: false, stack: 0 },
      ],
    });

    expect(classification).toBe("WAITING_FOR_FOLDED_ACTOR");
  });
});
