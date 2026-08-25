import { describe, expect, it } from "vitest";
import {
  findNextBetActorSeat,
  isBetRoundComplete,
  needsActionForBet,
} from "../flow/betRoundUtils.js";

describe("Badugi waiting freeze regression", () => {
  it("does not leave Hero pending when Hero has matched and acted in BET draw2", () => {
    const players = [
      {
        name: "Hero",
        stack: 934,
        betThisRound: 21,
        hasActedThisRound: true,
        folded: false,
        allIn: false,
      },
      {
        name: "Mina",
        stack: 0,
        betThisRound: 0,
        hasActedThisRound: true,
        folded: true,
        allIn: false,
      },
      {
        name: "Ren",
        stack: 0,
        betThisRound: 0,
        hasActedThisRound: true,
        folded: true,
        allIn: false,
      },
      {
        name: "Kai",
        stack: 0,
        betThisRound: 0,
        hasActedThisRound: true,
        folded: true,
        allIn: false,
      },
    ];

    expect(needsActionForBet(players[0], 21)).toBe(false);
    expect(findNextBetActorSeat(players, 1, 21)).toBeNull();
    expect(isBetRoundComplete({ players, currentBet: 21 })).toBe(true);
  });

  it("keeps an eligible unmatched caller pending before closing the round", () => {
    const players = [
      {
        name: "Hero",
        stack: 934,
        betThisRound: 21,
        hasActedThisRound: true,
        folded: false,
        allIn: false,
      },
      {
        name: "Mina",
        stack: 100,
        betThisRound: 0,
        hasActedThisRound: false,
        folded: false,
        allIn: false,
      },
    ];

    expect(needsActionForBet(players[1], 21)).toBe(true);
    expect(findNextBetActorSeat(players, 1, 21)).toBe(1);
    expect(isBetRoundComplete({ players, currentBet: 21 })).toBe(false);
  });
});
