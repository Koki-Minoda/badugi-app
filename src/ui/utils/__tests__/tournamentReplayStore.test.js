import { describe, it, expect, beforeEach } from "vitest";
import {
  initTournamentReplay,
  appendTournamentReplayHand,
  finalizeTournamentReplay,
  getTournamentReplay,
  resetTournamentReplay,
} from "../tournamentReplayStore.js";

describe("tournamentReplayStore", () => {
  beforeEach(() => {
    resetTournamentReplay();
  });

  it("captures config and hands when initialized", () => {
    initTournamentReplay({ id: "test", tables: 2 });
    appendTournamentReplayHand({
      handId: "hero-1",
      tableId: "table-1",
      seatResults: [
        { playerId: "p1", seatIndex: 0, startingStack: 500, stack: 0 },
        { playerId: "p2", seatIndex: 1, startingStack: 400, stack: 900 },
      ],
    });
    const replay = getTournamentReplay();
    expect(replay).toBeTruthy();
    expect(replay.config.id).toBe("test");
    expect(replay.hands).toHaveLength(1);
    expect(replay.hands[0].seatResults[0]).toMatchObject({
      playerId: "p1",
      startStack: 500,
      endStack: 0,
      bustedThisHand: true,
    });
  });

  it("finalizes replay with placements", () => {
    initTournamentReplay({ id: "test", tables: 1 });
    finalizeTournamentReplay(
      { championId: "hero", playersRemaining: 1 },
      [{ id: "hero", place: 1 }],
    );
    const replay = getTournamentReplay();
    expect(replay.finalState.championId).toBe("hero");
    expect(replay.finalState.placements).toEqual([{ id: "hero", place: 1 }]);
  });

  it("reset clears replay data", () => {
    initTournamentReplay({ id: "reset-test" });
    resetTournamentReplay();
    expect(getTournamentReplay()).toBeNull();
  });
});
