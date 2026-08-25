import { describe, expect, it } from "vitest";
import { shouldRevealPlayerHand } from "../../_core/allInVisibilityPolicy.js";

const variants = [
  ["D01", "deuce_to_seven_triple_draw"],
  ["D02", "ace_to_five_triple_draw"],
  ["S01", "deuce_to_seven_single_draw"],
  ["S02", "ace_to_five_single_draw"],
  ["Badugi", "badugi"],
];

describe("draw all-in visibility regression", () => {
  it.each(variants)("%s keeps all-in hands hidden before showdown", (_name, variantId) => {
    const player = {
      allIn: true,
      folded: false,
      hand: ["AS", "2D", "3H", "4C", "5S"],
      showHand: true,
    };

    expect(
      shouldRevealPlayerHand({
        variantId,
        player,
        seatIndex: 1,
        heroSeat: 0,
        phase: "DRAW",
        allInActionComplete: true,
      }),
    ).toBe(false);
  });

  it.each(variants)("%s reveals eligible all-in hands at showdown", (_name, variantId) => {
    expect(
      shouldRevealPlayerHand({
        variantId,
        player: { allIn: true, folded: false, hand: ["AS", "2D", "3H", "4C", "5S"] },
        seatIndex: 1,
        heroSeat: 0,
        phase: "SHOWDOWN",
      }),
    ).toBe(true);
  });

  it.each(variants)("%s keeps folded hands hidden even at showdown", (_name, variantId) => {
    expect(
      shouldRevealPlayerHand({
        variantId,
        player: { allIn: true, folded: true, hand: ["AS", "2D", "3H", "4C", "5S"] },
        seatIndex: 1,
        heroSeat: 0,
        phase: "SHOWDOWN",
      }),
    ).toBe(false);
  });
});
