import { describe, expect, test, vi } from "vitest";
import { findNextDrawActorSeat, findNextActiveSeat } from "../actionUtils.js";
import { findNextBetActorSeat } from "../betRoundUtils.js";
import {
  findNextActorSeatForPhase,
  findNextActiveSeatUnified,
} from "../nextActorUtils.js";

const samplePlayers = [
  { name: "Seat0", isSeated: true, isActiveInGame: true, folded: false, allIn: false, betThisRound: 0, hasActedThisRound: false },
  { name: "Seat1", isSeated: true, isActiveInGame: true, folded: false, allIn: false, betThisRound: 5, hasActedThisRound: false },
  { name: "Seat2", isSeated: true, isActiveInGame: true, folded: true, allIn: false, betThisRound: 5, hasActedThisRound: true },
  { name: "Seat3", isSeated: true, isActiveInGame: true, folded: false, allIn: false, betThisRound: 0, hasActedThisRound: false },
];

describe("findNextActorSeatForPhase", () => {
  test("delegates to BET helper", () => {
    const expected = findNextBetActorSeat(samplePlayers, 0, 5);
    const actual = findNextActorSeatForPhase({
      phase: "BET",
      players: samplePlayers,
      startIdx: 0,
      currentBet: 5,
    });
    expect(actual).toBe(expected);
  });

  test("delegates to DRAW helper", () => {
    const expected = findNextDrawActorSeat(samplePlayers, 1);
    const actual = findNextActorSeatForPhase({
      phase: "DRAW",
      players: samplePlayers,
      startIdx: 1,
    });
    expect(actual).toBe(expected);
  });

  test("warns on unknown phase", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = findNextActorSeatForPhase({ phase: "SHOWDOWN", players: samplePlayers });
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("findNextActiveSeatUnified", () => {
  test("delegates to nextActive helper", () => {
    const expected = findNextActiveSeat(samplePlayers, 0);
    const actual = findNextActiveSeatUnified(samplePlayers, 0);
    expect(actual).toBe(expected);
  });
});
