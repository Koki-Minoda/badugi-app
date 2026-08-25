import { describe, expect, it } from "vitest";
import { shouldWaitForHeroDrawTurn } from "../game/drawActorUtils.js";
import { mergeSeatViewsForDisplay } from "../utils/seatViewMerge.js";

describe("Badugi folded draw waiting regression", () => {
  it("does not wait for a folded hero during DRAW", () => {
    expect(
      shouldWaitForHeroDrawTurn({
        phase: "DRAW",
        turn: 0,
        heroIndex: 0,
        players: [
          {
            seatIndex: 0,
            folded: true,
            hasFolded: true,
            hand: ["AS", "2H", "3C", "4D"],
          },
        ],
      }),
    ).toBe(false);
  });

  it("keeps folded Badugi seats mucked instead of exposing stale cards", () => {
    const seats = mergeSeatViewsForDisplay({
      variantId: "badugi",
      phase: "DRAW",
      baseSeats: [
        {
          seatIndex: 0,
          isHero: true,
          folded: true,
          hasFolded: true,
          hand: ["AS", "2H", "3C", "4D"],
        },
      ],
      adapterSeatViews: [],
    });

    expect(seats[0].folded).toBe(true);
    expect(seats[0].showHand).toBe(true);
    expect(seats[0].hand).toHaveLength(4);
  });
});
