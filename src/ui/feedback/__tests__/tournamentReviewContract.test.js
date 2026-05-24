import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildTournamentReviewContract,
  isTournamentReviewContract,
  TOURNAMENT_REVIEW_CONTRACT_TYPE,
  TOURNAMENT_REVIEW_FEEDBACK_STATUS,
  TOURNAMENT_REVIEW_SCHEMA_VERSION,
} from "../tournamentReviewContract.js";

function makeHand(index, overrides = {}) {
  const variantId = overrides.variantId ?? (index % 2 === 0 ? "D01" : "D02");
  return {
    handId: `t-hand-${index}`,
    tournamentId: "mtt-7",
    variantId,
    startedAt: 1000 + index,
    endedAt: 2000 + index,
    heroNet: index === 1 ? -160 : 80,
    pot: 220 + index,
    seats: [
      {
        seat: 0,
        isHero: true,
        stack: overrides.heroStack ?? 460,
        busted: overrides.heroBusted === true,
        actions: [
          {
            seq: 1,
            street: "BET",
            type: index % 2 === 0 ? "raise" : "call",
            amount: index % 2 === 0 ? 40 : 20,
            toCall: 20,
            currentBet: 40,
            stackBefore: 500,
            stackAfter: 460,
            position: "BTN",
            legalActions: ["fold", "call", "raise"],
          },
          {
            seq: 2,
            street: "DRAW",
            type: "draw",
            drawCount: 2,
            metadata: {
              drawInfo: {
                drawCount: 2,
              },
            },
          },
        ],
      },
    ],
    pots: [
      {
        winners: [{ seat: 0, amount: index === 1 ? 0 : 220 }],
      },
    ],
    ...overrides,
  };
}

describe("tournamentReviewContract", () => {
  it("builds a tournament-only review contract with result, hero actions, key hands, and replay refs", () => {
    const hands = [makeHand(0), makeHand(1), makeHand(2, { heroBusted: true, heroNet: -420 })];
    const contract = buildTournamentReviewContract({
      tournament: {
        tournamentId: "mtt-7",
        name: "Alpha Store MTT",
        buyIn: 1000,
      },
      hands,
      placements: [
        { id: "hero-player", place: 2, name: "Hero", stack: 0, payout: 1500 },
        { id: "cpu-1", place: 1, name: "Sora", stack: 3000, payout: 2500 },
      ],
      heroSeat: 0,
      heroPlayerId: "hero-player",
      hasAuth: true,
    });

    expect(isTournamentReviewContract(contract)).toBe(true);
    expect(contract).toMatchObject({
      contractType: TOURNAMENT_REVIEW_CONTRACT_TYPE,
      schemaVersion: TOURNAMENT_REVIEW_SCHEMA_VERSION,
      mode: "tournament",
      tournamentId: "mtt-7",
      variantId: "mixed",
      variantIds: ["D01", "D02"],
      placement: 2,
      payout: 1500,
      roi: 0.5,
      heroNet: -500,
      totalHands: 3,
      result: {
        tournamentId: "mtt-7",
        title: "Alpha Store MTT",
        placement: 2,
        payout: 1500,
        buyIn: 1000,
        netResult: 500,
        roi: 0.5,
        championId: "cpu-1",
      },
      feedbackStatus: {
        state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.SUMMARY,
        reason: "local_summary_ready",
        handCount: 3,
        totalHands: 3,
        heroActionCount: 6,
      },
    });
    expect(contract.hands).toHaveLength(3);
    expect(contract.hands[0]).toMatchObject({
      handId: "t-hand-0",
      tournamentId: "mtt-7",
      variantId: "D01",
      heroSeat: 0,
      actionCount: 2,
      heroActionSeqRange: { start: 1, end: 2 },
    });
    expect(contract.heroActions).toHaveLength(6);
    expect(contract.heroActions[0]).toMatchObject({
      handId: "t-hand-0",
      variantId: "D01",
      actionSeq: 1,
      phase: "BET",
      action: "raise",
      toCall: 20,
      currentBet: 40,
      stackBefore: 500,
      stackAfter: 460,
      position: "BTN",
      legalActions: ["fold", "call", "raise"],
    });
    expect(contract.heroActions[1]).toMatchObject({
      actionSeq: 2,
      phase: "DRAW",
      action: "draw",
      drawCount: 2,
    });
    expect(contract.bustHand).toMatchObject({
      handId: "t-hand-2",
      reason: "bust-hand",
    });
    expect(contract.biggestWin).toMatchObject({
      handId: "t-hand-0",
      reason: "biggest-win",
    });
    expect(contract.biggestLoss).toMatchObject({
      handId: "t-hand-2",
      reason: "biggest-loss",
    });
    expect(contract.keyHands.length).toBeGreaterThan(0);
    expect(contract.keyHands[0]).toMatchObject({
      reason: "bust-hand",
      title: "Bust hand",
      description: expect.any(String),
      phase: "BET",
      heroAction: "raise",
      pot: 222,
      heroNet: -420,
      replayRef: expect.objectContaining({
        target: expect.objectContaining({
          handId: "t-hand-2",
          actionSeqStart: 1,
        }),
      }),
    });
    expect(contract.replayRefs).toHaveLength(contract.keyHands.length);
    expect(contract.replayRefs[0]).toMatchObject({
      handId: expect.any(String),
      target: {
        handId: expect.any(String),
        actionSeqStart: expect.any(Number),
      },
      available: true,
    });
    expect(contract.reviewSummary).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.SUMMARY,
      source: "local-summary",
      reviewedHands: 3,
      heroActionCount: 6,
      keyHandCount: contract.keyHands.length,
    });
    expect(contract).not.toHaveProperty("feedbackPayload");
    expect(contract.feedbackStatus).not.toHaveProperty("minHands");
  });

  it("uses unauthenticated instead of blocking the local tournament summary", () => {
    const contract = buildTournamentReviewContract({
      tournament: { tournamentId: "mtt-8" },
      hands: [makeHand(0), makeHand(1), makeHand(2)],
      hasAuth: false,
    });

    expect(contract.feedbackStatus).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.UNAUTHENTICATED,
      reason: "login_required_for_saved_ai_review",
      hasAuth: false,
      handCount: 3,
    });
    expect(contract.nextImprovements.items.length).toBeGreaterThan(0);
    expect(contract.aiFeedback.enabled).toBe(false);
  });

  it("preserves request lifecycle status for loading, error, and completed feedback", () => {
    const base = {
      tournament: { tournamentId: "mtt-9" },
      hands: [makeHand(0), makeHand(1), makeHand(2)],
      hasAuth: true,
    };

    expect(
      buildTournamentReviewContract({
        ...base,
        requestState: { loading: true },
      }).feedbackStatus,
    ).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.LOADING,
      reason: "request_in_flight",
    });
    expect(
      buildTournamentReviewContract({
        ...base,
        requestState: { error: "network_failed" },
      }).feedbackStatus,
    ).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.ERROR,
      reason: "request_failed",
      error: "network_failed",
    });
    expect(
      buildTournamentReviewContract({
        ...base,
        requestState: {
          response: {
            adviceJa: "良かった点...",
            source: "openai",
            feedbackId: 41,
            sessionKey: "tournament:mtt-9:mixed",
            storedAt: "2026-05-24T00:00:00.000Z",
          },
        },
      }).feedbackStatus,
    ).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.COMPLETE,
      reason: "feedback_available",
      source: "openai",
      feedbackId: 41,
      sessionKey: "tournament:mtt-9:mixed",
      storedAt: "2026-05-24T00:00:00.000Z",
    });
  });

  it("does not require the cash-review 30 hand gate for tournament summaries", () => {
    const contract = buildTournamentReviewContract({
      tournament: { tournamentId: "short-mtt" },
      hands: [makeHand(0), makeHand(1)],
      hasAuth: true,
    });

    expect(isTournamentReviewContract(contract)).toBe(true);
    expect(contract.feedbackStatus).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.SUMMARY,
      reason: "local_summary_ready",
      handCount: 2,
      totalHands: 2,
      heroActionCount: 4,
    });
    expect(contract.feedbackStatus).not.toHaveProperty("minHands");
    expect(contract).not.toHaveProperty("feedbackPayload");
  });

  it("does not import Cash Review payload helpers or the 30 hand gate", () => {
    const source = readFileSync("src/ui/feedback/tournamentReviewContract.js", "utf8");

    expect(source).not.toContain("buildPlayFeedbackPayload");
    expect(source).not.toContain("MIN_FEEDBACK_HANDS");
  });

  it("falls back to insufficient_logs only when hand or hero action evidence is missing", () => {
    const noHands = buildTournamentReviewContract({
      tournament: { tournamentId: "empty-mtt" },
      hands: [],
      hasAuth: true,
    });
    const noHeroActions = buildTournamentReviewContract({
      tournament: { tournamentId: "no-actions-mtt" },
      hands: [
        {
          handId: "no-actions",
          variantId: "D01",
          seats: [{ seat: 0, isHero: true, actions: [] }],
        },
      ],
      hasAuth: true,
    });

    expect(noHands.feedbackStatus).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.INSUFFICIENT_LOGS,
      reason: "insufficient_logs",
      handCount: 0,
      heroActionCount: 0,
    });
    expect(noHeroActions.feedbackStatus).toMatchObject({
      state: TOURNAMENT_REVIEW_FEEDBACK_STATUS.INSUFFICIENT_LOGS,
      reason: "insufficient_logs",
      handCount: 1,
      heroActionCount: 0,
    });
  });

  it("extracts tournament key hands in review priority order", () => {
    const allInHand = makeHand(1, {
      heroNet: -500,
      pot: 900,
      seats: [
        {
          seat: 0,
          isHero: true,
          actions: [
            {
              seq: 3,
              street: "BET",
              type: "raise",
              amount: 500,
              stackBefore: 500,
              stackAfter: 0,
            },
          ],
        },
      ],
    });
    const showdownHand = makeHand(2, {
      heroNet: 700,
      pot: 700,
      showdown: true,
      seats: [
        {
          seat: 0,
          isHero: true,
          actions: [{ seq: 4, street: "SHOWDOWN", type: "show" }],
        },
      ],
    });
    const bustHand = makeHand(3, {
      heroBusted: true,
      heroNet: -200,
      pot: 200,
      seats: [
        {
          seat: 0,
          isHero: true,
          stack: 0,
          busted: true,
          actions: [{ seq: 5, street: "BET", type: "call", stackAfter: 0 }],
        },
      ],
    });

    const contract = buildTournamentReviewContract({
      tournament: { tournamentId: "priority-mtt" },
      hands: [makeHand(0, { heroNet: 100, pot: 300 }), allInHand, showdownHand, bustHand],
      hasAuth: true,
    });

    expect(contract.keyHands.map((hand) => hand.reason)).toEqual([
      "bust-hand",
      "biggest-loss",
      "biggest-win",
      "hero-all-in",
      "showdown",
      "large-pot",
      "draw-decision",
      "final-hand",
    ]);
    expect(contract.keyHands.find((hand) => hand.reason === "hero-all-in")).toMatchObject({
      handId: "t-hand-1",
      title: "Hero all-in",
      phase: "BET",
      heroAction: "raise",
      pot: 900,
      heroNet: -500,
      replayRef: expect.objectContaining({
        target: expect.objectContaining({
          handId: "t-hand-1",
          actionSeqStart: 3,
        }),
      }),
    });
    expect(contract.keyHands.find((hand) => hand.reason === "draw-decision")).toMatchObject({
      title: "Draw decision",
      phase: "DRAW",
      heroAction: "draw",
    });
  });
});
