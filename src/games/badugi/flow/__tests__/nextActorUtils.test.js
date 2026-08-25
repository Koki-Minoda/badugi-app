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

  // TASK-07: explicit null guard for each terminal / non-action phase.
  test.each([
    ["POST_BLINDS"],
    ["SHOWDOWN"],
    ["COLLECT"],
    ["RESULT"],
  ])("%s returns null and does not throw", (phase) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let result;
    expect(() => {
      result = findNextActorSeatForPhase({ phase, players: samplePlayers });
    }).not.toThrow();
    expect(result).toBeNull();
    warn.mockRestore();
  });

  // TASK-07: BET with eligible players returns a concrete seat, not null.
  test("BET returns the first eligible seat that has not yet matched the current bet", () => {
    // Seat 0 has already raised and acted; seat 1 still owes chips; seat 2 is folded.
    const players = [
      { name: "Seat0", isSeated: true, isActiveInGame: true, folded: false, allIn: false, betThisRound: 10, hasActedThisRound: true, stack: 490 },
      { name: "Seat1", isSeated: true, isActiveInGame: true, folded: false, allIn: false, betThisRound: 0,  hasActedThisRound: false, stack: 500 },
      { name: "Seat2", isSeated: true, isActiveInGame: true, folded: true,  allIn: false, betThisRound: 0,  hasActedThisRound: false, stack: 500 },
    ];
    const seat = findNextActorSeatForPhase({ phase: "BET", players, startIdx: 0, currentBet: 10 });
    expect(typeof seat).toBe("number");
    expect(seat).toBe(1);
  });

  // TASK-07: DRAW with eligible players returns a concrete seat, not null.
  test("DRAW returns the first seat that has not yet drawn this round", () => {
    // Seat 0 has already taken a draw; seat 1 is next; seat 2 is folded.
    const players = [
      { name: "Seat0", isSeated: true, isActiveInGame: true, folded: false, allIn: false, hasDrawn: true,  hasActedThisRound: true,  stack: 490 },
      { name: "Seat1", isSeated: true, isActiveInGame: true, folded: false, allIn: false, hasDrawn: false, hasActedThisRound: false, stack: 500 },
      { name: "Seat2", isSeated: true, isActiveInGame: true, folded: true,  allIn: false, hasDrawn: false, hasActedThisRound: false, stack: 500 },
    ];
    const seat = findNextActorSeatForPhase({ phase: "DRAW", players, startIdx: 0 });
    expect(typeof seat).toBe("number");
    expect(seat).toBe(1);
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
