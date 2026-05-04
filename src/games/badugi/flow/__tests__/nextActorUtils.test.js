import { describe, expect, test, vi } from "vitest";
import {
  findNextDrawActorSeat,
  findNextActiveSeat,
  firstBetterAfterBlinds,
  getBlindSeatsForPlayers,
  isPlayerActiveInGame,
} from "../actionUtils.js";
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

  test("DRAW helper includes all-in seats that still need to exchange cards", () => {
    const players = [
      { name: "All-in", isSeated: true, isActiveInGame: true, stack: 0, allIn: true, folded: false, hasActedThisRound: false, hasDrawn: false },
      { name: "Done", isSeated: true, isActiveInGame: true, stack: 100, allIn: false, folded: false, hasActedThisRound: true, hasDrawn: true },
      { name: "Busted", isSeated: true, isActiveInGame: true, stack: 0, allIn: false, isBusted: true, seatOut: true, hasActedThisRound: false },
    ];

    expect(findNextDrawActorSeat(players, 0)).toBe(0);
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

describe("blind and active-seat helpers", () => {
  test("ignores stale active flags on busted seats", () => {
    expect(isPlayerActiveInGame({ isActiveInGame: true, isBusted: true, stack: 0 })).toBe(false);
    expect(isPlayerActiveInGame({ isActiveInGame: true, seatOut: true, stack: 0 })).toBe(false);
  });

  test("compresses blinds and first actor around busted seats", () => {
    const players = [
      { name: "Hero", isSeated: true, isActiveInGame: true, stack: 880, folded: false, allIn: false, hasActedThisRound: false },
      { name: "Busted", isSeated: true, isActiveInGame: true, isBusted: true, seatOut: true, stack: 0 },
      { name: "Seat2", isSeated: true, isActiveInGame: true, stack: 435, folded: false, allIn: false, hasActedThisRound: false },
      { name: "Seat3", isSeated: true, isActiveInGame: true, stack: 105, folded: false, allIn: false, hasActedThisRound: false },
      { name: "Seat4", isSeated: true, isActiveInGame: true, stack: 0, isBusted: true, seatOut: true },
      { name: "Seat5", isSeated: true, isActiveInGame: true, stack: 945, folded: false, allIn: false, hasActedThisRound: false },
    ];
    expect(getBlindSeatsForPlayers(players, 3)).toEqual({ sbIdx: 5, bbIdx: 0 });
    expect(firstBetterAfterBlinds(players, 3)).toBe(2);
  });
});
