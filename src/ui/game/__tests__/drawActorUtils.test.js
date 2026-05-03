import { describe, expect, it } from "vitest";
import { shouldWaitForHeroDrawTurn } from "../drawActorUtils.js";

const hero = (overrides = {}) => ({
  name: "Hero",
  folded: false,
  hasFolded: false,
  seatOut: false,
  allIn: false,
  hasDrawn: false,
  hasActedThisRound: false,
  canDraw: true,
  ...overrides,
});

describe("draw actor UI helpers", () => {
  it("waits for the hero only when the hero can actually draw", () => {
    expect(
      shouldWaitForHeroDrawTurn({
        phase: "DRAW",
        turn: 0,
        players: [hero()],
      }),
    ).toBe(true);
  });

  it("does not wait on a folded hero during DRAW", () => {
    expect(
      shouldWaitForHeroDrawTurn({
        phase: "DRAW",
        turn: 0,
        players: [hero({ folded: true, hasFolded: true, hasActedThisRound: true })],
      }),
    ).toBe(false);
  });

  it("does not wait on an all-in or already drawn hero during DRAW", () => {
    expect(
      shouldWaitForHeroDrawTurn({
        phase: "DRAW",
        turn: 0,
        players: [hero({ allIn: true })],
      }),
    ).toBe(false);

    expect(
      shouldWaitForHeroDrawTurn({
        phase: "DRAW",
        turn: 0,
        players: [hero({ hasDrawn: true, hasActedThisRound: true })],
      }),
    ).toBe(false);
  });
});
