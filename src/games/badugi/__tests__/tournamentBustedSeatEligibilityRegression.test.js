import { describe, expect, it } from "vitest";
import {
  findNextDrawActorSeat,
  isSeatEligibleForBet,
  isSeatEligibleForDraw,
} from "../flow/actionUtils.js";

describe("tournament busted seat eligibility regression", () => {
  it("never treats busted/out players as BET or DRAW actors", () => {
    const busted = {
      seatIndex: 2,
      stack: 0,
      folded: true,
      hasFolded: true,
      seatOut: true,
      isBusted: true,
      hand: ["AS", "2H", "3C", "4D"],
    };

    expect(isSeatEligibleForBet(busted)).toBe(false);
    expect(isSeatEligibleForDraw(busted)).toBe(false);
  });

  it("keeps all-in non-busted players visible and draw eligible", () => {
    const allIn = {
      seatIndex: 3,
      stack: 0,
      allIn: true,
      folded: false,
      seatOut: false,
      isBusted: false,
      hand: ["AS", "2H", "3C", "4D"],
    };

    expect(isSeatEligibleForBet(allIn)).toBe(false);
    expect(isSeatEligibleForDraw(allIn)).toBe(true);
  });

  it("skips busted seats when selecting the next draw actor", () => {
    const players = [
      { seatIndex: 0, folded: true, hasFolded: true, hand: ["AS", "2H", "3C", "4D"] },
      { seatIndex: 1, folded: false, hand: ["5S", "6H", "7C", "8D"], hasDrawn: true },
      { seatIndex: 2, folded: true, isBusted: true, seatOut: true, hand: ["9S", "TH", "JC", "QD"] },
      { seatIndex: 3, folded: false, hand: ["KS", "AH", "2C", "3D"], hasDrawn: false },
    ];

    expect(findNextDrawActorSeat(players, 0)).toBe(3);
  });
});
