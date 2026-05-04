import { afterEach, describe, expect, it } from "vitest";
import {
  buildFeedbackSessionKey,
  getLatestPlayFeedbackResult,
  listPlayFeedbackResults,
  savePlayFeedbackResult,
} from "../playFeedbackStore.js";

describe("playFeedbackStore", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores and reloads the latest feedback by session key", () => {
    const payload = {
      mode: "tournament",
      variantScope: "mixed",
      handCount: 30,
      summary: { tournament: { tournamentId: "tourney-1" } },
      keyHands: [{ situationId: "B-07", handId: "hand-7", actionSeqRange: { start: 2, end: 4 } }],
    };
    const response = { adviceJa: "改善点", source: "fallback" };

    const saved = savePlayFeedbackResult({ payload, response });

    expect(saved.sessionKey).toBe("tournament:tourney-1:mixed");
    expect(buildFeedbackSessionKey(payload)).toBe(saved.sessionKey);
    expect(getLatestPlayFeedbackResult(payload).response.adviceJa).toBe("改善点");
    expect(getLatestPlayFeedbackResult(payload).keyHands[0]).toMatchObject({ situationId: "B-07" });
    expect(listPlayFeedbackResults({ sessionKey: saved.sessionKey })).toHaveLength(1);
  });
});
