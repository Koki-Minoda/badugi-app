import { describe, expect, it } from "vitest";
import {
  buildTournamentTestFixture,
  completeHand,
  finishTournamentToChampion,
} from "../fixtures/buildTournamentTestFixture.js";

describe("tournament hero lifecycle", () => {
  it("supports hero fold/loss/win stack updates through hand summaries", () => {
    let state = buildTournamentTestFixture("default").state;
    state = completeHand(state, state.tables[0].tableId, [
      { seatIndex: 0, playerId: "hero", startingStack: 500, stack: 450 },
    ]);
    expect(state.players.hero.stack).toBe(450);
    expect(state.players.hero.busted).toBe(false);
  });

  it("marks hero bust terminal state and removes further seating", () => {
    let state = buildTournamentTestFixture("heroBust").state;
    state = completeHand(state, state.tables[0].tableId, [
      { seatIndex: 0, playerId: "hero", startingStack: 500, stack: 0 },
    ]);
    expect(state.players.hero.busted).toBe(true);
    expect(state.players.hero.tableId).toBeNull();
    expect(state.players.hero.seatIndex).toBeNull();
  });

  it("supports hero champion path", () => {
    const state = finishTournamentToChampion(buildTournamentTestFixture("heroChampion").state, "hero");
    expect(state.isFinished).toBe(true);
    expect(state.championId).toBe("hero");
    expect(state.players.hero.finishPlace).toBe(1);
  });
});
