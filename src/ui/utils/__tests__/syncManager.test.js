import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enqueueHandRecord,
  enqueueTournamentSnapshot,
  discardQueuedTournamentSnapshots,
  flushQueue,
  resumeTournamentSnapshot,
  retireTournamentSnapshot,
} from "../syncManager.js";

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

  it("coalesces tournament saves and sends the newest lossless snapshot", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
      text: async () => "",
    });
    enqueueTournamentSnapshot({ version: 1, config: { id: "store-mtt" }, marker: 1 });
    enqueueTournamentSnapshot({ version: 1, config: { id: "store-mtt" }, marker: 2 });

    await flushQueue({ accessToken: "token-1", tokenType: "Bearer" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/tournament/save"),
      expect.objectContaining({ body: expect.stringContaining('"marker":2') }),
    );
  });

  it("loads and retires the authenticated remote tournament snapshot", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ hasSnapshot: false, snapshot: null }),
      text: async () => "",
    });

    await resumeTournamentSnapshot({ accessToken: "token-1", tokenType: "Bearer" });
    await retireTournamentSnapshot({ accessToken: "token-1", tokenType: "Bearer" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("/api/tournament/resume"),
      expect.stringContaining("/api/tournament/retire"),
    ]);
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("drops queued saves before retire so a finished tournament cannot resurrect", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "retired" }),
      text: async () => "",
    });
    enqueueTournamentSnapshot({ version: 1, config: { id: "finished-mtt" } });
    discardQueuedTournamentSnapshots();
    await retireTournamentSnapshot({ accessToken: "token-1", tokenType: "Bearer" });
    await flushQueue({ accessToken: "token-1", tokenType: "Bearer" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/tournament/retire");
  });
});
