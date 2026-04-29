import { describe, expect, it } from "vitest";
import {
  getVariant,
  hasVariant,
  listVariants,
  registerVariant,
} from "../variantRegistry.js";

describe("variantRegistry", () => {
  it("returns initial variants", () => {
    expect(getVariant("badugi")?.id).toBe("badugi");
    expect(getVariant("plo")?.id).toBe("plo");
    expect(getVariant("double_board_bomb_pot_omaha")?.id).toBe(
      "double_board_bomb_pot_omaha",
    );
  });

  it("reports missing variants without throwing", () => {
    expect(hasVariant("badugi")).toBe(true);
    expect(getVariant("missing")).toBeNull();
    expect(hasVariant("missing")).toBe(false);
  });

  it("rejects duplicate variant ids", () => {
    expect(() => registerVariant(getVariant("badugi"))).toThrow(/already registered/);
  });

  it("lists registered variants", () => {
    const ids = listVariants().map((variant) => variant.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "badugi",
        "nl_holdem",
        "limit_holdem",
        "plo",
        "double_board_bomb_pot_omaha",
      ]),
    );
  });

  it("keeps Omaha board and bomb pot constraints", () => {
    const plo = getVariant("plo");
    const bombPot = getVariant("double_board_bomb_pot_omaha");

    expect(plo.boards.count).toBe(1);
    expect(plo.holeCards.mustUse).toBe(2);
    expect(bombPot.boards.count).toBe(2);
    expect(bombPot.betting.hasPreflop).toBe(false);
    expect(bombPot.forcedBets.type).toBe("bombPot");
    expect(bombPot.holeCards.mustUse).toBe(2);
  });
});
