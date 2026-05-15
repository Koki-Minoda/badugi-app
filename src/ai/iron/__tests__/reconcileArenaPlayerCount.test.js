import { describe, expect, it } from "vitest";

import { countPlayerFlags, effectiveOpportunityPlayerCount } from "../reconcileArenaPlayerCount.js";

describe("reconcileArenaPlayerCount", () => {
  it("keeps gameplay state untouched while deriving replay-compatible player count", () => {
    const snapshot = {
      players: Array.from({ length: 6 }, (_, seatIndex) => ({
        seatIndex,
        folded: false,
        hasFolded: false,
        allIn: false,
        isAllIn: false,
      })),
    };
    const flags = countPlayerFlags(snapshot);
    const reconciled = effectiveOpportunityPlayerCount({
      activePlayers: flags.activePlayers,
      foldedPlayers: flags.foldedPlayers,
      allInPlayers: flags.allInPlayers,
      bettingEligiblePlayers: 3,
      potEligiblePlayers: 3,
      replayCompatibleMode: true,
    });
    expect(flags.activePlayers).toBe(6);
    expect(reconciled).toBe(3);
  });
});
