import { describe, expect, it } from "vitest";
import ChinesePokerController from "../ChinesePokerController.js";
import {
  CHINESE_HISTORY_STORAGE_KEY,
  loadChinesePokerHistory,
  persistChinesePokerHistory,
  replayChinesePokerHistory,
} from "../chinesePokerHistory.js";

function seededRandom() {
  let state = 42;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

describe("Chinese Poker history", () => {
  it("replays the exact card rows and scoring from a completed hand", () => {
    const controller = new ChinesePokerController({ random: seededRandom() });
    const started = controller.startNewHand();
    controller.setRows(started.players[0].id, started.players[0].rows);
    const result = controller.resolveShowdown();
    const history = controller.getHandHistory();
    const replay = replayChinesePokerHistory(history);

    expect(replay).toMatchObject({ valid: true, errors: [] });
    expect(replay.snapshot.results).toEqual(result.results);
    expect(replay.snapshot.players.map((player) => player.rows)).toEqual(result.players.map((player) => player.rows));
    expect(history.events.map((event) => event.type)).toEqual(["HAND_START", "ROWS_SET", "SHOWDOWN"]);
  });

  it("persists at most 50 unique completed histories", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    for (let index = 0; index < 55; index += 1) {
      persistChinesePokerHistory({ handId: `chinese-${index}` }, storage);
    }
    const loaded = loadChinesePokerHistory(storage);
    expect(loaded).toHaveLength(50);
    expect(loaded[0].handId).toBe("chinese-54");
    expect(values.has(CHINESE_HISTORY_STORAGE_KEY)).toBe(true);
  });
});
