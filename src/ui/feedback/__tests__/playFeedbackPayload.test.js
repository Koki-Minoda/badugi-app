import { describe, expect, it } from "vitest";
import {
  buildPlayFeedbackPayload,
  MIN_FEEDBACK_HANDS,
} from "../playFeedbackPayload.js";

function makeHand(index, overrides = {}) {
  return {
    handId: `hand-${index}`,
    variantId: index % 2 === 0 ? "badugi" : "D01",
    heroNet: index % 3 === 0 ? 40 : -20,
    seats: [
      {
        seat: 0,
        name: "Hero",
        actions: [
          {
            seq: 1,
            street: "BET",
            type: index % 4 === 0 ? "raise" : "call",
            metadata: {
              betInfo: {
                before: ["AC", "2C", "9C", "KH"],
                toCall: 20,
              },
            },
          },
        ],
        handLabel: index % 5 === 0 ? "Badugi 8" : undefined,
      },
    ],
    pots: [
      {
        potIndex: 0,
        potAmount: 80,
        winners: [
          { seat: 0, amount: index % 3 === 0 ? 80 : 0 },
          ...(index % 7 === 0 ? [{ seat: 1, amount: 40 }] : []),
        ],
      },
    ],
    ...overrides,
  };
}

describe("playFeedbackPayload", () => {
  it("blocks feedback for sessions below the minimum hand count", () => {
    const result = buildPlayFeedbackPayload({
      hands: Array.from({ length: MIN_FEEDBACK_HANDS - 1 }, (_, index) => makeHand(index)),
    });

    expect(result).toMatchObject({
      eligible: false,
      reason: "not_enough_hands",
      handCount: MIN_FEEDBACK_HANDS - 1,
      payload: null,
    });
  });

  it("builds a session payload with cash play stats and issue summaries", () => {
    const result = buildPlayFeedbackPayload({
      hands: Array.from({ length: MIN_FEEDBACK_HANDS }, (_, index) => makeHand(index)),
      mode: "cash",
      variantScope: "mixed",
    });

    expect(result.eligible).toBe(true);
    expect(result.payload).toMatchObject({
      schemaVersion: 1,
      mode: "cash",
      variantScope: "mixed",
      handCount: MIN_FEEDBACK_HANDS,
      summary: {
        hands: MIN_FEEDBACK_HANDS,
        variants: {
          badugi: 15,
          D01: 15,
        },
      },
    });
    expect(result.payload.summary.vpip).toBeGreaterThan(0.9);
    expect(result.payload.summary.pfr).toBeGreaterThan(0);
    expect(result.payload.summary.topIssues.length).toBeGreaterThan(0);
    expect(result.payload.keyHands[0]).toMatchObject({
      situationId: expect.stringMatching(/^(B|D01)-\d{2}$/),
      handId: expect.any(String),
      actionSeqRange: { start: 1, end: 1 },
      heroAction: expect.stringMatching(/^(call|raise)$/),
      toCall: 20,
    });
    expect(result.payload.summary.topIssues[0]).toMatchObject({
      handId: expect.any(String),
      situationId: expect.any(String),
      actionSeqRange: expect.objectContaining({ start: expect.any(Number) }),
    });
    expect(result.payload.promptContext.constraints).toContain("30ハンド未満のセッションは評価しない");
  });

  it("includes tournament ROI when tournament context is supplied", () => {
    const result = buildPlayFeedbackPayload({
      hands: Array.from({ length: MIN_FEEDBACK_HANDS }, (_, index) => makeHand(index)),
      mode: "tournament",
      tournament: {
        tournamentId: "t-1",
        buyIn: 1000,
        prize: 2500,
        finish: 2,
      },
    });

    expect(result.payload.summary.tournament).toMatchObject({
      tournamentId: "t-1",
      finish: 2,
      buyIn: 1000,
      prize: 2500,
      roi: 1.5,
    });
    expect(result.payload.summary.roi).toBe(1.5);
  });
});
