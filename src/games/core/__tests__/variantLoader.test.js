import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLocalFallbackVariant,
  loadVariant,
  loadVariants,
  normalizeDbVariant,
} from "../variantLoader.js";

const dbBombPot = {
  variant_key: "double_board_bomb_pot_omaha",
  name: "Double Board Bomb Pot Omaha",
  description:
    "Pot Limit Omaha bomb pot played with two boards. Each board awards half the pot unless one player scoops both boards.",
  base_game: "omaha",
  deck_type: "standard52",
  min_players: 2,
  max_players: 9,
  hole_cards: {
    count: 4,
    mustUse: 2,
  },
  boards: {
    count: 2,
    cards_per_board: 5,
    streets: ["flop", "turn", "river"],
  },
  betting: {
    structure: "potLimit",
    streets: ["flop", "turn", "river"],
    has_preflop: false,
  },
  forced_bets: {
    type: "bombPot",
    everyone_posts: true,
    amount_bb: 5,
  },
  showdown: {
    evaluator: "omahaHigh",
    split_mode: "byBoard",
    scoop_allowed: true,
  },
  modifiers: ["doubleBoard", "bombPot", "potLimit", "noPreflop"],
};

function mockFetchJson(payload, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: vi.fn().mockResolvedValue(payload),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("variantLoader", () => {
  it("normalizes snake_case DB responses into VariantDefinition", () => {
    const variant = normalizeDbVariant(dbBombPot);

    expect(variant).toMatchObject({
      id: "double_board_bomb_pot_omaha",
      name: "Double Board Bomb Pot Omaha",
      description: dbBombPot.description,
      base: "omaha",
      players: { min: 2, max: 9 },
      deck: { type: "standard52" },
      holeCards: { count: 4, mustUse: 2 },
      boards: { count: 2, cardsPerBoard: 5, streets: ["flop", "turn", "river"] },
      betting: {
        structure: "potLimit",
        streets: ["flop", "turn", "river"],
        hasPreflop: false,
      },
      forcedBets: { type: "bombPot", everyonePosts: true, amountBB: 5 },
      showdown: { evaluator: "omahaHigh", splitMode: "byBoard", scoopAllowed: true },
      modifiers: ["doubleBoard", "bombPot", "potLimit", "noPreflop"],
    });
    expect(variant.boards.cards_per_board).toBeUndefined();
    expect(variant.betting.has_preflop).toBeUndefined();
    expect(variant.forcedBets.everyone_posts).toBeUndefined();
    expect(variant.forcedBets.amount_bb).toBeUndefined();
    expect(variant.showdown.split_mode).toBeUndefined();
    expect(variant.showdown.scoop_allowed).toBeUndefined();
  });

  it("returns DB variant when API succeeds", async () => {
    mockFetchJson(dbBombPot);

    const variant = await loadVariant("double_board_bomb_pot_omaha");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/variants/double_board_bomb_pot_omaha"));
    expect(variant.id).toBe("double_board_bomb_pot_omaha");
    expect(variant.forcedBets.amountBB).toBe(5);
  });

  it("returns local fallback when API fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const variant = await loadVariant("plo");

    expect(variant.id).toBe("plo");
    expect(variant.boards.count).toBe(1);
  });

  it("can fallback double_board_bomb_pot_omaha locally", () => {
    const variant = getLocalFallbackVariant("double_board_bomb_pot_omaha");

    expect(variant.id).toBe("double_board_bomb_pot_omaha");
    expect(variant.boards.count).toBe(2);
  });

  it("loadVariants returns local variants when API fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const variants = await loadVariants();
    const ids = variants.map((variant) => variant.id);

    expect(ids).toEqual(
      expect.arrayContaining(["badugi", "plo", "double_board_bomb_pot_omaha"]),
    );
  });

  it("falls back when DB variant fails validation", async () => {
    mockFetchJson({
      ...dbBombPot,
      hole_cards: { count: 4 },
    });

    const variant = await loadVariant("double_board_bomb_pot_omaha");

    expect(variant.id).toBe("double_board_bomb_pot_omaha");
    expect(variant.holeCards.mustUse).toBe(2);
    expect(variant.forcedBets.amountBB).toBe(1);
  });

  it("returns null for missing variant with no fallback", async () => {
    mockFetchJson({ detail: "variant_not_found" }, false, 404);

    const variant = await loadVariant("missing_variant");

    expect(variant).toBeNull();
  });

  it("uses only valid DB variants and falls back if none are valid", async () => {
    mockFetchJson([{ ...dbBombPot, boards: { count: 0, cardsPerBoard: 0, streets: [] } }]);

    const variants = await loadVariants();
    const ids = variants.map((variant) => variant.id);

    expect(ids).toEqual(
      expect.arrayContaining(["badugi", "plo", "double_board_bomb_pot_omaha"]),
    );
  });
});
