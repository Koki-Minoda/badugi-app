import { afterEach, describe, expect, it, vi } from "vitest";
import { hasStoredFeedbackAuth, requestPlayFeedback } from "../playFeedbackApi.js";

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
});
