import { test, expect } from "@playwright/test";
import { BadugiUIAdapter } from "../../src/ui/game/badugi/BadugiUIAdapter.js";
import { DrawLowballUIAdapter } from "../../src/ui/game/draw/DrawLowballUIAdapter.js";

const variants = [
  { variantId: "badugi", adapter: () => new BadugiUIAdapter(), handSize: 4 },
  { variantId: "D01", adapter: () => new DrawLowballUIAdapter(), handSize: 5 },
  { variantId: "D02", adapter: () => new DrawLowballUIAdapter(), handSize: 5 },
  { variantId: "S01", adapter: () => new DrawLowballUIAdapter(), handSize: 5 },
  { variantId: "S02", adapter: () => new DrawLowballUIAdapter(), handSize: 5 },
];

function handCards(count: number) {
  return ["AS", "2D", "3H", "4C", "5S"].slice(0, count);
}

test.describe("Core5 draw all-in visibility regression", () => {
  for (const { variantId, adapter, handSize } of variants) {
    test(`${variantId} hides all-in hand before showdown and reveals at showdown`, async () => {
      const ui = adapter();
      const active = ui.buildViewProps({
        controllerSnapshot: {
          variantId,
          phase: "DRAW",
          turn: 1,
          allInActionComplete: true,
          players: [
            { name: "Hero", stack: 500, hand: handCards(handSize) },
            {
              name: "All-in CPU",
              stack: 0,
              allIn: true,
              folded: false,
              hand: handCards(handSize),
              showHand: true,
            },
          ],
          pots: [{ amount: 80, eligible: [0, 1] }],
        },
        tableConfig: { bbValue: 20, maxDraws: variantId.startsWith("S") ? 1 : 3 },
      });

      expect(active.seatViews[1].allIn).toBe(true);
      expect(active.seatViews[1].showHand).toBe(false);

      const showdown = ui.buildViewProps({
        controllerSnapshot: {
          variantId,
          phase: "SHOWDOWN",
          turn: null,
          players: [
            { name: "Hero", stack: 500, hand: handCards(handSize) },
            {
              name: "All-in CPU",
              stack: 0,
              allIn: true,
              folded: false,
              hand: handCards(handSize),
            },
          ],
          pots: [{ amount: 80, eligible: [0, 1] }],
        },
        tableConfig: { bbValue: 20, maxDraws: variantId.startsWith("S") ? 1 : 3 },
      });

      expect(showdown.seatViews[1].showHand).toBe(true);
      expect(showdown.seatViews[1].hand).toEqual(handCards(handSize));
    });
  }
});
