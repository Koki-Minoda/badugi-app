import { describe, expect, it } from "vitest";
import { findReplayFrameIndex } from "../replayFrameUtils.js";

describe("ReplayScreen helpers", () => {
  it("finds a replay frame by hand-history action sequence", () => {
    const frames = [
      { phase: "BET", event: { type: "BET_ACTION", seat: 1, actionSeq: 1 } },
      { phase: "DRAW", event: { type: "DRAW_ACTION", seat: 0, actionSeq: 4 } },
      { phase: "BET", event: { type: "BET_ACTION", seat: 0, actionSeq: 5 } },
    ];

    expect(findReplayFrameIndex(frames, { actionSeq: 4, seat: 0 })).toBe(1);
  });

  it("finds a replay frame from feedback replayTarget actionSeqStart", () => {
    const frames = [
      { phase: "BET", event: { type: "BET_ACTION", seat: 1, actionSeq: 1 } },
      { phase: "DRAW", event: { type: "DRAW_ACTION", seat: 0, actionSeq: 4 } },
      { phase: "BET", event: { type: "BET_ACTION", seat: 0, actionSeq: 5 } },
    ];

    expect(findReplayFrameIndex(frames, { handId: "h-1", actionSeqStart: 5 })).toBe(2);
    expect(
      findReplayFrameIndex(frames, {
        replayTarget: { handId: "h-1", actionSeqStart: 4 },
      }),
    ).toBe(1);
  });

  it("falls back from feedback actionSeqRange start", () => {
    const frames = [
      { phase: "BET", event: { type: "BET_ACTION", seat: 1, actionSeq: 1 } },
      { phase: "BET", event: { type: "BET_ACTION", seat: 0, actionSeq: 7 } },
    ];

    expect(findReplayFrameIndex(frames, { actionSeqRange: { start: 7, end: 9 } })).toBe(1);
  });

  it("falls back to seat, street, and action type when actionSeq is unavailable", () => {
    const frames = [
      { phase: "BET", event: { type: "BET_ACTION", seat: 1, action: "call" } },
      { phase: "DRAW", event: { type: "DRAW_ACTION", seat: 0 } },
      { phase: "BET", event: { type: "BET_ACTION", seat: 0, action: "raise" } },
    ];

    expect(findReplayFrameIndex(frames, { seat: 0, street: "BET", type: "raise" })).toBe(2);
  });
});
