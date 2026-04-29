import { describe, expect, it } from "vitest";
import { getMaxDiscardCount, toggleDrawSelection } from "../drawSelection.js";

describe("drawSelection", () => {
  it("caps 4-card draw selections by hand size", () => {
    const hand = ["AS", "2D", "3C", "4H"];

    expect(getMaxDiscardCount({ hand, maxDiscardCount: 5 })).toBe(4);
    expect(
      [0, 1, 2, 3, 4].reduce(
        (selection, cardIndex) =>
          toggleDrawSelection(selection, cardIndex, { hand, maxDiscardCount: 5 }),
        [],
      ),
    ).toEqual([0, 1, 2, 3]);
  });

  it("allows 5-card draw selections through the shared helper", () => {
    const hand = ["7S", "5D", "4C", "3H", "2S"];

    expect(getMaxDiscardCount({ hand, maxDiscardCount: 5 })).toBe(5);
    expect(
      [0, 1, 2, 3, 4].reduce(
        (selection, cardIndex) =>
          toggleDrawSelection(selection, cardIndex, { hand, maxDiscardCount: 5 }),
        [],
      ),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it("toggles an already-selected card off without changing other selections", () => {
    expect(toggleDrawSelection([0, 2, 3], 2, { maxDiscardCount: 4 })).toEqual([0, 3]);
  });
});
