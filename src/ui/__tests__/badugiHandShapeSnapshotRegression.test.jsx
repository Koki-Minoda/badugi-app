import { describe, expect, it } from "vitest";
import { assertNoCrossVariantStateLeak } from "../qa/assertNoCrossVariantStateLeak.js";
import { mergeSeatViewsForDisplay } from "../utils/seatViewMerge.js";

describe("Badugi hand shape snapshot regression", () => {
  it("flags Badugi snapshots that contain five-card draw-lowball hands", () => {
    const result = assertNoCrossVariantStateLeak({
      currentVariant: "badugi",
      controllerClass: "BadugiGameController",
      controllerVariantRef: "badugi",
      controllerSnapshotVariantId: "badugi",
      snapshot: {
        variantId: "badugi",
        players: [
          { seatIndex: 0, hand: ["AS", "2H", "3C", "4D", "5S"] },
          { seatIndex: 1, hand: ["KS", "QH", "JC", "TD"] },
        ],
      },
    });

    expect(result.status).toBe("FAIL");
    expect(result.violations.map((violation) => violation.type)).toContain(
      "CROSS_VARIANT_HAND_SHAPE",
    );
  });

  it("does not render stale five-card base hands in a Badugi table view", () => {
    const seats = mergeSeatViewsForDisplay({
      variantId: "badugi",
      phase: "DRAW",
      baseSeats: [
        {
          seatIndex: 0,
          isHero: true,
          hand: ["AS", "2H", "3C", "4D", "5S"],
          cards: ["AS", "2H", "3C", "4D", "5S"],
        },
      ],
      adapterSeatViews: [],
    });

    expect(seats[0].handShapeRejected).toBe(true);
    expect(seats[0].hand).toEqual([]);
    expect(seats[0].cards).toEqual([]);
  });

  it("allows valid four-card Badugi hands", () => {
    const seats = mergeSeatViewsForDisplay({
      variantId: "badugi",
      phase: "DRAW",
      baseSeats: [
        {
          seatIndex: 0,
          isHero: true,
          hand: ["AS", "2H", "3C", "4D"],
          cards: ["AS", "2H", "3C", "4D"],
        },
      ],
      adapterSeatViews: [],
    });

    expect(seats[0].handShapeRejected).toBeUndefined();
    expect(seats[0].hand).toHaveLength(4);
    expect(seats[0].cards).toHaveLength(4);
  });
});
