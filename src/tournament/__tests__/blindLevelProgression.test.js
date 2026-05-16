import { describe, expect, it } from "vitest";
import {
  CORE5_TOURNAMENT_VARIANTS,
  buildTournamentTestFixture,
  completeHand,
  getCurrentLevel,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament blind and level progression", () => {
  it.each(CORE5_TOURNAMENT_VARIANTS)("starts %s at level 1 with configured blinds", (variant) => {
    const { state } = buildTournamentTestFixture("blindLevelUp", { variant });
    const level = getCurrentLevel(state);
    expect(level.levelIndex).toBe(1);
    expect(level.smallBlind).toBe(5);
    expect(level.bigBlind).toBe(10);
    expect(state.tables[0].handsPlayedAtThisLevel).toBe(0);
  });

  it("advances blinds only at hand boundary and previews next level", () => {
    const { state } = buildTournamentTestFixture("blindLevelUp");
    const before = getCurrentLevel(state);
    expect(before.bigBlind).toBe(10);

    const afterHand = completeHand(state, state.tables[0].tableId, [], 1);
    const after = getCurrentLevel(afterHand);
    expect(after.levelIndex).toBe(2);
    expect(after.smallBlind).toBe(10);
    expect(after.bigBlind).toBe(20);
    expect(afterHand.tables[0].handsPlayedAtThisLevel).toBe(0);
  });

  it("keeps final level capped and handles blind-forced all-in stacks", () => {
    let next = buildTournamentTestFixture("blindLevelUp").state;
    for (let hand = 1; hand <= 5; hand += 1) {
      next = completeHand(next, next.tables[0].tableId, [], hand);
    }
    expect(getCurrentLevel(next).levelIndex).toBe(3);
    const shortStack = { stack: 15 };
    const level = getCurrentLevel(next);
    expect(shortStack.stack).toBeLessThan(level.bigBlind);
  });
});
