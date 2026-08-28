import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeRoom, getRoomState, RoomApiError } from "../roomApi.js";

describe("roomApi retry metadata", () => {
  beforeEach(() => {
    window.localStorage.setItem(
      "mgx_auth",
      JSON.stringify({ accessToken: "token", tokenType: "Bearer" }),
    );
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("preserves Retry-After seconds on a 429 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: { get: (name) => (name === "Retry-After" ? "3" : null) },
      json: async () => ({
        detail: { code: "state_rate_limited", message: "Too many room state requests" },
      }),
    }));

    const error = await getRoomState("ABC234").catch((caught) => caught);
    expect(error).toBeInstanceOf(RoomApiError);
    expect(error.status).toBe(429);
    expect(error.code).toBe("state_rate_limited");
    expect(error.retryAfterMs).toBe(3_000);
  });

  it("closes a normalized room through the owner-only DELETE API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ roomCode: "ABC234", closed: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(closeRoom(" abc234 ")).resolves.toMatchObject({
      roomId: "ABC234",
      closed: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/p2p/rooms/ABC234"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
