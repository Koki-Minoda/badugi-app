import { describe, expect, it } from "vitest";
import { buildReplayTimeline } from "../replayTimelineViewModel.js";

describe("buildReplayTimeline", () => {
  it("groups repeated streets and presents chronological named actions with positions", () => {
    const history = {
      buttonSeat: 0,
      seats: [
        { seat: 0, name: "Hero" },
        { seat: 1, name: "Sora" },
        { seat: 2, name: "Mina" },
      ],
      events: [{ type: "BLINDS_POSTED", sbSeat: 1, bbSeat: 2 }],
    };
    const frames = [
      { phase: "BET", event: { type: "BET_ACTION", seat: 0, action: "raise", amount: 40 } },
      { phase: "BET", event: { type: "BET_ACTION", seat: 1, action: "call", amount: 30 } },
      { phase: "DRAW", event: { type: "DRAW_ACTION", seat: 1, discarded: ["AS", "2D"] } },
      { phase: "DRAW", event: { type: "DRAW_ACTION", seat: 0, discarded: [] } },
      { phase: "BET", event: { type: "BET_ACTION", seat: 2, action: "check", amount: 0 } },
    ];

    const groups = buildReplayTimeline(frames, history);

    expect(groups.map((group) => group.id)).toEqual(["BET-1", "DRAW-1", "BET-2"]);
    expect(groups[0].rows.map((row) => [row.actionOrder, row.playerName, row.position, row.description])).toEqual([
      [1, "Hero", "BTN", "RAISE 40"],
      [2, "Sora", "SB", "CALL 30"],
    ]);
    expect(groups[1].rows.map((row) => row.description)).toEqual(["DRAW 2", "STAND PAT"]);
    expect(groups[2].rows[0]).toMatchObject({ actionOrder: 5, playerName: "Mina", position: "BB", description: "CHECK" });
  });

  it("falls back safely when old history has no position metadata", () => {
    const groups = buildReplayTimeline(
      [{ phase: "BET", event: { type: "BET_ACTION", seat: 4, action: "fold" } }],
      { seats: [] },
    );
    expect(groups[0].rows[0]).toMatchObject({ playerName: "Seat 5", position: "Seat 5", description: "FOLD" });
  });
});
