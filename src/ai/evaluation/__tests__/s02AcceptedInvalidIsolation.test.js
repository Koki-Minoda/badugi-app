import { describe, expect, it } from "vitest";

import { repairReplayActionLegality } from "../repairReplayActionLegality.js";

describe("S02 accepted invalid isolation", () => {
  it("classifies raise-cap stale raise as repairable", () => {
    const controller = {
      getLegalActions() {
        return [{ type: "FOLD" }, { type: "CALL", toCall: 20 }];
      },
      getUiSnapshot(state) {
        return state.snapshot;
      },
    };
    const state = {
      snapshot: {
        currentActor: 0,
        currentBet: 20,
        metadata: { raiseCountThisRound: 4, maxRaisesThisRound: 4 },
        players: [{ stack: 300, betThisRound: 0 }],
      },
    };
    const result = repairReplayActionLegality({
      controller,
      state,
      actorSeat: 0,
      action: { type: "RAISE" },
      replayResult: { invalidReason: "LEGAL_ACTION_MISMATCH", errors: ["Fixed-limit raise cap reached"] },
      sample: { legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }], bettingRound: 2, drawRound: 1 },
    });
    expect(result.invalidReason).toBe("RAISE_CAP_REACHED");
    expect(result.ok).toBe(true);
    expect(result.repairType).toBe("RAISE_TO_CALL");
  });
});
