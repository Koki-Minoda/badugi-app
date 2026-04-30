import { describe, expect, it } from "vitest";
import { GAME_VARIANTS } from "../variants.js";

describe("core controller variant registry", () => {
  it("registers playable draw-family controller factories", () => {
    expect(GAME_VARIANTS.deuce_to_seven_triple_draw?.variantId).toBe("D01");
    expect(GAME_VARIANTS.ace_to_five_triple_draw?.variantId).toBe("D02");
    expect(GAME_VARIANTS.deuce_to_seven_single_draw?.variantId).toBe("S01");
    expect(GAME_VARIANTS.ace_to_five_single_draw?.variantId).toBe("S02");
  });

  it("creates UI-compatible snapshots for D01/D02/S01/S02 controllers", () => {
    const expected = [
      ["deuce_to_seven_triple_draw", "D01"],
      ["ace_to_five_triple_draw", "D02"],
      ["deuce_to_seven_single_draw", "S01"],
      ["ace_to_five_single_draw", "S02"],
    ];

    expected.forEach(([engineKey, variantId]) => {
      const controller = GAME_VARIANTS[engineKey].controllerFactory({
        seatConfig: ["HERO", "CPU", "CPU"],
        startingStack: 500,
        structure: { sb: 5, bb: 10, ante: 0 },
      });
      const initial = controller.createInitialState();
      const handState = controller.createNewHandState(initial);
      const snapshot = controller.getUiSnapshot(handState);

      expect(snapshot.variantId).toBe(variantId);
      expect(snapshot.gameId).toBe(engineKey);
      expect(snapshot.players).toHaveLength(3);
      expect(snapshot.phase).toBeDefined();
    });
  });
});
