import { describe, expect, it } from "vitest";
import { findNextDrawActorSeat, isSeatEligibleForDraw } from "../flow/actionUtils.js";

const active = (overrides = {}) => ({
  seatIndex: 0,
  name: "Seat",
  hand: ["AS", "2H", "3C", "4D"],
  folded: false,
  hasFolded: false,
  seatOut: false,
  isBusted: false,
  isActiveInGame: true,
  allIn: false,
  hasDrawn: false,
  hasActedThisRound: false,
  ...overrides,
});

describe("Badugi folded draw actor regression", () => {
  it("never selects a folded seat as a draw actor", () => {
    const players = [
      active({ seatIndex: 0, folded: true, hasFolded: true, hasActedThisRound: true }),
      active({ seatIndex: 1, hasDrawn: false, hasActedThisRound: false }),
      active({ seatIndex: 2, folded: true, hasFolded: true, hasActedThisRound: true }),
    ];

    expect(isSeatEligibleForDraw(players[0])).toBe(false);
    expect(findNextDrawActorSeat(players, 0)).toBe(1);
  });

  it("returns null when every remaining seat is folded or already resolved", () => {
    const players = [
      active({ seatIndex: 0, folded: true, hasFolded: true, hasActedThisRound: true }),
      active({ seatIndex: 1, hasDrawn: true, hasActedThisRound: true }),
      active({ seatIndex: 2, seatOut: true, isBusted: true }),
    ];

    expect(findNextDrawActorSeat(players, 0)).toBeNull();
  });

  it("keeps all-in non-folded seats eligible for draw decisions", () => {
    const players = [
      active({ seatIndex: 0, allIn: true, stack: 0, hasDrawn: false, hasActedThisRound: false }),
      active({ seatIndex: 1, folded: true, hasFolded: true }),
    ];

    expect(isSeatEligibleForDraw(players[0])).toBe(true);
    expect(findNextDrawActorSeat(players, 0)).toBe(0);
  });
});
