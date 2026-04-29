import { describe, expect, it } from "vitest";
import { createBoards, getBoardById, isDoubleBoardVariant } from "../boardManager.js";
import { getVariant } from "../variantRegistry.js";

describe("boardManager", () => {
  it("creates one array-backed board for PLO", () => {
    const boards = createBoards(getVariant("plo"));

    expect(boards).toEqual([{ id: "A", cards: [] }]);
    expect(getBoardById(boards, "A")).toEqual({ id: "A", cards: [] });
    expect(isDoubleBoardVariant(getVariant("plo"))).toBe(false);
  });

  it("creates A/B boards for double board bomb pot Omaha", () => {
    const variant = getVariant("double_board_bomb_pot_omaha");
    const boards = createBoards(variant);

    expect(boards).toEqual([
      { id: "A", cards: [] },
      { id: "B", cards: [] },
    ]);
    expect(isDoubleBoardVariant(variant)).toBe(true);
  });
});
