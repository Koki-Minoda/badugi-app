import { describe, expect, it } from "vitest";
import {
  buildPlayFeedbackPayload,
  createFeedbackScopeOptions,
  filterHandsForFeedbackScope,
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

  it("filters feedback payloads to the explicitly selected variant scope", () => {
    const hands = Array.from({ length: 60 }, (_, index) => makeHand(index));
    const result = buildPlayFeedbackPayload({
      hands,
      mode: "cash",
      variantScope: "variant:D01",
    });

    expect(result.eligible).toBe(true);
    expect(result.sourceHandCount).toBe(60);
    expect(result.handCount).toBe(30);
    expect(result.payload.variantScope).toBe("variant:D01");
    expect(result.payload.feedbackScope).toMatchObject({
      type: "variant",
      variantId: "D01",
      sourceHandCount: 60,
      handCount: 30,
    });
    expect(result.payload.summary.variants).toEqual({ D01: 30 });
    expect(result.payload.keyHands.every((spot) => spot.variantId === "D01")).toBe(true);
    expect(result.payload.replayLinks.length).toBe(result.payload.keyHands.length);
    expect(result.payload.replayLinks.every((link) => link.variantId === "D01")).toBe(true);
    expect(result.payload.replayLinks.every((link) => link.handExists === true)).toBe(true);
    expect(
      result.payload.replayLinks.every((link) => link.replayTarget?.actionSeqStart === 1),
    ).toBe(true);
    expect(result.payload.promptContext.constraints).toContain(
      "feedbackScope.variantId または mixed scope に従い、対象外variantを混ぜない",
    );
  });

  it("applies the 30 hand gate after variant filtering, not before it", () => {
    const hands = [
      ...Array.from({ length: 30 }, (_, index) =>
        makeHand(index, { handId: `badugi-${index}`, variantId: "badugi" }),
      ),
      ...Array.from({ length: MIN_FEEDBACK_HANDS - 1 }, (_, index) =>
        makeHand(index + 100, { handId: `plo-${index}`, variantId: "plo" }),
      ),
    ];

    const result = buildPlayFeedbackPayload({
      hands,
      mode: "cash",
      variantScope: "variant:plo",
    });

    expect(result).toMatchObject({
      eligible: false,
      reason: "not_enough_hands",
      sourceHandCount: 59,
      handCount: 29,
      payload: null,
    });
  });

  it("requires an explicit feedback scope before building a sendable payload", () => {
    const result = buildPlayFeedbackPayload({
      hands: Array.from({ length: MIN_FEEDBACK_HANDS }, (_, index) => makeHand(index)),
      mode: "cash",
      variantScope: "",
    });

    expect(result).toMatchObject({
      eligible: false,
      reason: "select_feedback_scope",
      payload: null,
    });
  });

  it("keeps mixed feedback explicit and exposes per-variant scope options", () => {
    const hands = Array.from({ length: 40 }, (_, index) => makeHand(index));
    const options = createFeedbackScopeOptions(hands, { mode: "cash" });

    expect(options[0]).toMatchObject({
      value: "mixed",
      type: "mixed",
      handCount: 40,
    });
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "variant:badugi", handCount: 20 }),
        expect.objectContaining({ value: "variant:D01", handCount: 20 }),
      ]),
    );
    expect(filterHandsForFeedbackScope(hands, "mixed")).toHaveLength(40);
    expect(filterHandsForFeedbackScope(hands, "variant:badugi")).toHaveLength(20);
  });
});
