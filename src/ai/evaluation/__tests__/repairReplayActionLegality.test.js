import { describe, expect, it } from "vitest";

import { repairReplayActionLegality } from "../repairReplayActionLegality.js";

describe("repairReplayActionLegality", () => {
  it("repairs stale raise to call when call remains legal", () => {
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
        metadata: { raiseCountThisRound: 3 },
        players: [{ stack: 200, betThisRound: 0 }],
      },
    };
    const result = repairReplayActionLegality({
      controller,
      state,
      actorSeat: 0,
      action: { type: "RAISE" },
      replayResult: { invalidReason: "LEGAL_ACTION_MISMATCH", errors: ["fixed-limit raise cap reached"] },
      sample: { legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }], position: "late" },
    });
    expect(result.ok).toBe(true);
    expect(result.repairType).toBe("RAISE_TO_CALL");
    expect(result.repairedAction.type).toBe("CALL");
  });

  it("rejects repair when no fallback action is legal", () => {
    const controller = {
      getLegalActions() {
        return [{ type: "FOLD" }];
      },
      getUiSnapshot(state) {
        return state.snapshot;
      },
    };
    const state = {
      snapshot: {
        currentActor: 0,
        currentBet: 20,
        metadata: { raiseCountThisRound: 3 },
        players: [{ stack: 200, betThisRound: 0 }],
      },
    };
    const result = repairReplayActionLegality({
      controller,
      state,
      actorSeat: 0,
      action: { type: "RAISE" },
      replayResult: { invalidReason: "LEGAL_ACTION_MISMATCH", errors: ["fixed-limit raise cap reached"] },
      sample: { legalActions: [{ type: "FOLD" }, { type: "CALL" }, { type: "RAISE" }] },
    });
    expect(result.ok).toBe(false);
    expect(result.repairedAction).toBeNull();
  });
});
