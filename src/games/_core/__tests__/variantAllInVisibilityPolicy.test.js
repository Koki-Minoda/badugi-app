import { describe, expect, it } from "vitest";
import {
  ALL_IN_VISIBILITY,
  getAllInVisibilityPolicy,
  shouldRevealPlayerHand,
} from "../allInVisibilityPolicy.js";

const drawVariants = ["badugi", "D01", "D02", "S01", "S02"];
const boardVariants = ["nlh", "flh", "plo", "plo8", "flo8", "five_card_plo", "big_o"];

describe("variant all-in visibility policy", () => {
  it.each(drawVariants)("%s uses showdown-only reveal", (variantId) => {
    expect(getAllInVisibilityPolicy(variantId)).toBe(ALL_IN_VISIBILITY.SHOWDOWN_ONLY);
    expect(
      shouldRevealPlayerHand({
        variantId,
        player: { allIn: true, folded: false, hand: ["AS", "2D", "3H", "4C"] },
        seatIndex: 1,
        heroSeat: 0,
        phase: "DRAW",
        allInActionComplete: true,
      }),
    ).toBe(false);
    expect(
      shouldRevealPlayerHand({
        variantId,
        player: { allIn: true, folded: false, hand: ["AS", "2D", "3H", "4C"] },
        seatIndex: 1,
        heroSeat: 0,
        phase: "SHOWDOWN",
      }),
    ).toBe(true);
  });

  it.each(boardVariants)("%s may reveal after all-in action is complete", (variantId) => {
    expect(getAllInVisibilityPolicy(variantId)).toBe(ALL_IN_VISIBILITY.ACTION_COMPLETE);
    expect(
      shouldRevealPlayerHand({
        variantId,
        player: { allIn: true, folded: false, holeCards: ["AS", "KS"] },
        seatIndex: 1,
        heroSeat: 0,
        street: "FLOP",
        allInActionComplete: true,
      }),
    ).toBe(true);
    expect(
      shouldRevealPlayerHand({
        variantId,
        player: { allIn: true, folded: false, holeCards: ["AS", "KS"] },
        seatIndex: 1,
        heroSeat: 0,
        street: "FLOP",
        allInActionComplete: false,
      }),
    ).toBe(false);
  });

  it("defaults unknown variants to showdown-only", () => {
    expect(getAllInVisibilityPolicy("unknown_variant")).toBe(ALL_IN_VISIBILITY.SHOWDOWN_ONLY);
  });

  it("never reveals folded hands through all-in policy", () => {
    expect(
      shouldRevealPlayerHand({
        variantId: "nlh",
        player: { allIn: true, folded: true, holeCards: ["AS", "KS"] },
        seatIndex: 1,
        heroSeat: 0,
        street: "SHOWDOWN",
        allInActionComplete: true,
      }),
    ).toBe(false);
  });
});
