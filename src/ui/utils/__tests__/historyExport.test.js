import { describe, expect, it } from "vitest";
import {
  HISTORY_EXPORT_SCHEMA,
  createHistoryExportPayload,
} from "../historyExport.js";

describe("history export", () => {
  it("creates a versioned, detached portable history bundle", () => {
    const source = [{ handId: "cash-1", events: [{ type: "ACTION", amount: 20 }] }];
    const payload = createHistoryExportPayload({
      cashHands: source,
      tournaments: [{ tournamentId: "store-1" }],
      tournamentHands: [{ handId: "mtt-1" }],
      liveHand: { handId: "live-1" },
      exportedAt: "2026-09-03T00:00:00.000Z",
    });
    expect(payload).toMatchObject({
      schema: HISTORY_EXPORT_SCHEMA,
      exportedAt: "2026-09-03T00:00:00.000Z",
      counts: { cashHands: 1, tournaments: 1, tournamentHands: 1, liveHands: 1 },
    });
    source[0].events[0].amount = 999;
    expect(payload.cashHands[0].events[0].amount).toBe(20);
  });
});
