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
    };
    const response = { adviceJa: "改善点", source: "fallback" };

    const saved = savePlayFeedbackResult({ payload, response });

    expect(saved.sessionKey).toBe("tournament:tourney-1:mixed");
    expect(buildFeedbackSessionKey(payload)).toBe(saved.sessionKey);
    expect(getLatestPlayFeedbackResult(payload).response.adviceJa).toBe("改善点");
    expect(listPlayFeedbackResults({ sessionKey: saved.sessionKey })).toHaveLength(1);
  });
});
