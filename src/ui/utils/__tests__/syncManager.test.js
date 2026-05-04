import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueHandRecord, flushQueue } from "../syncManager.js";

describe("syncManager hand history", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("syncs canonical hand history to generic history and structured badugi endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ stored: true }),
      text: async () => "",
    });

    enqueueHandRecord({
      handId: "hand-sync-1",
      variantId: "D01",
      winner: "Hero",
      endedAt: Date.UTC(2026, 4, 4, 10, 0),
      seats: [
        {
          seat: 0,
          name: "Hero",
          endStack: 620,
          actions: [{ type: "call", amount: 20, street: "BET", seq: 1 }],
        },
      ],
      pots: [
        {
          amount: 120,
          winners: [{ seat: 0, collect: 120 }],
        },
      ],
    });

    await flushQueue({ accessToken: "token-1", tokenType: "bearer" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/history/hand"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"variantId":"D01"'),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/badugi/hands"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"hand_id":"hand-sync-1"'),
      }),
    );
    expect(window.localStorage.getItem("sync.queue.v1")).toBe("[]");
  });
});
