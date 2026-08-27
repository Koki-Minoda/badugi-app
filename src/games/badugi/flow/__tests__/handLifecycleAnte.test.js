import { describe, expect, it } from "vitest";
import { buildNextHandState } from "../handLifecycle.js";

describe("Badugi hand lifecycle ante accounting", () => {
  it("keeps currentBet aligned with ante-inclusive street commitments", () => {
    const state = buildNextHandState({
      currentPlayers: [],
      numSeats: 6,
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
      startingStack: 500,
      nextDealerIdx: 5,
      blindStructure: [{ sb: 10, bb: 20, ante: 1, hands: 5 }],
      blindState: { blindLevelIndex: 0, handsInLevel: 0 },
      lastStructureIndex: 0,
      drawCardsForSeat: () => ["AS", "2H", "3D", "4C"],
    });

    expect(state.players[state.sbIdx].betThisRound).toBe(11);
    expect(state.players[state.bbIdx].betThisRound).toBe(21);
    expect(state.initialCurrentBet).toBe(21);
    expect(state.initialCurrentBet - state.players[state.resolvedTurn].betThisRound).toBe(20);
  });
});
