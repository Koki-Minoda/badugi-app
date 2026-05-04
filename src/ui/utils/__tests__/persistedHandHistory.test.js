import { describe, expect, it, vi } from "vitest";
import {
  findPersistedHandHistoryById,
  mergeHandHistoryLists,
  readPersistedHandHistory,
} from "../persistedHandHistory.js";

vi.mock("../../../utils/history.js", () => ({
  getHands: () => [
    { handId: "cash-1", endedAt: 30 },
    { handId: "dup-1", endedAt: 20 },
  ],
  getTournamentHands: () => [
    { handId: "tourney-1", ts: 40, tournamentId: "mtt-1" },
    { handId: "dup-1", ts: 10, tournamentId: "mtt-1" },
  ],
}));

describe("persistedHandHistory", () => {
  it("reads cash and tournament persisted hands with source labels", () => {
    const hands = readPersistedHandHistory();
    expect(hands).toEqual([
      { handId: "cash-1", endedAt: 30, historySource: "cash" },
      { handId: "dup-1", endedAt: 20, historySource: "cash" },
      { handId: "tourney-1", ts: 40, tournamentId: "mtt-1", historySource: "tournament" },
      { handId: "dup-1", ts: 10, tournamentId: "mtt-1", historySource: "tournament" },
    ]);
  });

  it("deduplicates in-memory hands before persisted fallback and sorts latest first", () => {
    const merged = mergeHandHistoryLists(
      [{ handId: "live-buffer", endedAt: 50 }, { handId: "dup-1", endedAt: 25 }],
      readPersistedHandHistory(),
    );

    expect(merged.map((hand) => hand.handId)).toEqual([
      "live-buffer",
      "tourney-1",
      "cash-1",
      "dup-1",
    ]);
    expect(merged.find((hand) => hand.handId === "dup-1")?.endedAt).toBe(25);
  });

  it("finds a persisted hand by id for replay fallback", () => {
    expect(findPersistedHandHistoryById("tourney-1")).toMatchObject({
      handId: "tourney-1",
      historySource: "tournament",
    });
    expect(findPersistedHandHistoryById("missing")).toBeNull();
  });
});
