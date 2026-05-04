import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlayFeedbackResults, hasStoredFeedbackAuth, requestPlayFeedback } from "../playFeedbackApi.js";

describe("playFeedbackApi", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("requires login when no auth token is stored", async () => {
    await expect(requestPlayFeedback({ handCount: 30 })).rejects.toThrow("login_required");
    expect(hasStoredFeedbackAuth()).toBe(false);
  });

  it("posts feedback payload with stored bearer token", async () => {
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({ accessToken: "token-1", tokenType: "bearer" }),
    );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ adviceJa: "助言", adviceEn: "Advice", source: "fallback" }),
    });

    const result = await requestPlayFeedback({ handCount: 30 });

    expect(result.adviceJa).toBe("助言");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analysis/play-feedback",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      }),
    );
    expect(hasStoredFeedbackAuth()).toBe(true);
  });

  it("fetches stored feedback results by session key", async () => {
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({ accessToken: "token-2", tokenType: "Bearer" }),
    );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, response: { adviceJa: "保存済み" } }],
    });

    const result = await fetchPlayFeedbackResults({ sessionKey: "cash:cash:mixed", limit: 3 });

    expect(result[0].response.adviceJa).toBe("保存済み");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analysis/play-feedback/results?session_key=cash%3Acash%3Amixed&limit=3",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-2",
        }),
      }),
    );
  });
});
