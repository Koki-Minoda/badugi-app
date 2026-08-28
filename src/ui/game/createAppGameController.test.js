import { describe, expect, it } from "vitest";
import { GAME_VARIANTS } from "../../games/core/variants.js";
import { createAppGameController } from "./createAppGameController.js";

describe("createAppGameController", () => {
  it.each(Object.keys(GAME_VARIANTS))("creates the registered %s controller", (variantId) => {
    const controller = createAppGameController({
      variantId,
      tableConfig: { seats: [], blinds: { sb: 5, bb: 10, ante: 0 } },
      drawConfig: { seatConfig: ["HUMAN", "CPU"], startingStack: 500 },
      badugiConfig: {
        numSeats: 2,
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
      },
    });
    expect(controller).toBeTruthy();
  });

  it("keeps Chinese Poker behind the same App factory boundary", () => {
    const controller = createAppGameController({ variantId: "chinese_poker" });
    expect(controller?.constructor?.name).toBe("ChinesePokerController");
  });

  it("returns null instead of silently constructing Badugi for an unknown variant", () => {
    expect(createAppGameController({ variantId: "unknown-game" })).toBeNull();
  });
});
