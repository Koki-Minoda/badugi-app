import { describe, expect, it } from "vitest";
import {
  mergeSeatViewsForDisplay,
  shouldRevealSeatHand,
} from "../seatViewMerge.js";

describe("seatViewMerge", () => {
  it("keeps active opponent hands visible at showdown even when adapter state is stale", () => {
    const result = mergeSeatViewsForDisplay({
      phase: "SHOWDOWN",
      baseSeats: [
        { seatIndex: 0, isHero: true, hand: ["4c"], showHand: true },
        { seatIndex: 1, hand: ["5d"], showHand: true, folded: false },
      ],
      adapterSeatViews: [
        { seatIndex: 0, hand: ["4c"], showHand: true },
        { seatIndex: 1, hand: ["5d"], showHand: false },
      ],
    });

    expect(result[1].showHand).toBe(true);
  });

  it("does not reveal folded opponent hands at showdown", () => {
    expect(
      shouldRevealSeatHand("SHOWDOWN", {
        seatIndex: 1,
        hand: ["5d"],
        folded: true,
      }),
    ).toBe(false);
  });

  it("does not reveal active opponent hands before showdown", () => {
    const result = mergeSeatViewsForDisplay({
      phase: "BET",
      baseSeats: [{ seatIndex: 1, hand: ["5d"], showHand: false }],
      adapterSeatViews: [{ seatIndex: 1, hand: ["5d"], showHand: false }],
    });

    expect(result[0].showHand).toBe(false);
  });

  it("does not let an adapter default avatar overwrite a roster image", () => {
    const result = mergeSeatViewsForDisplay({
      phase: "BET",
      baseSeats: [
        {
          seatIndex: 1,
          avatarUrl: "/characters/akira.png",
          avatar: "/characters/akira.png",
        },
      ],
      adapterSeatViews: [{ seatIndex: 1, avatar: "default_avatar" }],
    });

    expect(result[0]).toMatchObject({
      avatar: "/characters/akira.png",
      avatarUrl: "/characters/akira.png",
    });
  });

  it("does not let an empty adapter hand erase cards dealt by the app state", () => {
    const result = mergeSeatViewsForDisplay({
      phase: "BET",
      baseSeats: [
        {
          seatIndex: 0,
          isHero: true,
          hand: ["AS", "KS", "QS", "JS"],
          cards: ["AS", "KS", "QS", "JS"],
          showHand: true,
        },
      ],
      adapterSeatViews: [
        {
          seatIndex: 0,
          isHero: true,
          hand: [],
          cards: [],
          showHand: true,
        },
      ],
    });

    expect(result[0].hand).toEqual(["AS", "KS", "QS", "JS"]);
    expect(result[0].cards).toEqual(["AS", "KS", "QS", "JS"]);
  });
});
