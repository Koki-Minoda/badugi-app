import { describe, it, expect } from "vitest";
import { shouldSkipDrawRound } from "../roundFlow.jsx";

function player(overrides = {}) {
  return {
    seatOut: false,
    isBusted: false,
    folded: false,
    hasFolded: false,
    canDraw: true,
    allIn: false,
    drawRequest: 0,
    ...overrides,
  };
}

describe("roundFlow draw skip guard", () => {
  it("does not skip draw round when at least one seat can draw (even without drawRequest)", () => {
    const players = [
      player({ allIn: true }),
      player({ canDraw: true, allIn: false, drawRequest: 0 }),
      player({ folded: true, hasFolded: true }),
    ];
    expect(shouldSkipDrawRound({ players })).toBe(false);
  });

  it("skips draw round only when no actionable draw seat remains", () => {
    const players = [
      player({ allIn: true }),
      player({ folded: true, hasFolded: true }),
      player({ seatOut: true, isBusted: true }),
    ];
    expect(shouldSkipDrawRound({ players })).toBe(true);
  });
});
