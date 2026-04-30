import { describe, expect, it } from "vitest";
import {
  analyzeBadugiDrawMistakes,
  buildPostMatchFollowUpSummary,
  FOLLOW_UP_THRESHOLDS,
} from "../followUpAnalyzer.js";

function recordWithAction(action) {
  return {
    handId: "hand-follow-1",
    variantId: "badugi",
    seats: [
      {
        seat: 0,
        name: "Hero",
        actions: [action],
      },
    ],
  };
}

describe("followUpAnalyzer", () => {
  it("detects retained dead cards", () => {
    const issues = analyzeBadugiDrawMistakes(
      recordWithAction({
        seq: 4,
        street: "DRAW",
        type: "draw",
        drawCount: 1,
        discarded: [3],
        metadata: {
          drawInfo: {
            before: ["AC", "2C", "3D", "KH"],
            drawIndexes: [3],
            replacedCards: [{ index: 3, oldCard: "KH", newCard: "4S" }],
          },
        },
      }),
    );

    expect(issues.map((issue) => issue.type)).toContain("dead_card_retained");
    expect(issues.find((issue) => issue.type === "dead_card_retained")).toMatchObject({
      actionSeq: 4,
      severity: "medium",
    });
  });

  it("detects breaking a made Badugi", () => {
    const issues = analyzeBadugiDrawMistakes(
      recordWithAction({
        seq: 2,
        street: "DRAW",
        type: "draw",
        drawCount: 1,
        metadata: {
          drawInfo: {
            before: ["AC", "2D", "3H", "4S"],
            drawIndexes: [3],
            replacedCards: [{ index: 3, oldCard: "4S", newCard: "9C" }],
          },
        },
      }),
    );

    expect(issues[0]).toMatchObject({
      type: "made_badugi_broken",
      severity: "high",
      score: FOLLOW_UP_THRESHOLDS.high,
    });
  });

  it("detects overdraw and underdraw", () => {
    const overdraw = analyzeBadugiDrawMistakes(
      recordWithAction({
        seq: 1,
        street: "DRAW",
        type: "draw",
        drawCount: 3,
        metadata: {
          drawInfo: {
            before: ["AC", "2C", "3D", "4H"],
            drawIndexes: [1, 2, 3],
            replacedCards: [
              { index: 1, oldCard: "2C", newCard: "5S" },
              { index: 2, oldCard: "3D", newCard: "6S" },
              { index: 3, oldCard: "4H", newCard: "7S" },
            ],
          },
        },
      }),
    );
    const underdraw = analyzeBadugiDrawMistakes(
      recordWithAction({
        seq: 1,
        street: "DRAW",
        type: "draw",
        drawCount: 1,
        metadata: {
          drawInfo: {
            before: ["AC", "2C", "3C", "4H"],
            drawIndexes: [1],
            replacedCards: [{ index: 1, oldCard: "2C", newCard: "5S" }],
          },
        },
      }),
    );

    expect(overdraw.map((issue) => issue.type)).toContain("overdraw");
    expect(underdraw.map((issue) => issue.type)).toContain("underdraw");
  });

  it("builds a post-match summary with replay target", () => {
    const summary = buildPostMatchFollowUpSummary(
      recordWithAction({
        seq: 5,
        street: "DRAW",
        type: "draw",
        drawCount: 1,
        metadata: {
          drawInfo: {
            before: ["AC", "2D", "3H", "4S"],
            drawIndexes: [0],
            replacedCards: [{ index: 0, oldCard: "AC", newCard: "9C" }],
          },
        },
      }),
    );

    expect(summary).toMatchObject({
      handId: "hand-follow-1",
      issueCount: expect.any(Number),
      highestSeverity: "high",
      replayTarget: {
        handId: "hand-follow-1",
        actionSeq: 5,
        seat: 0,
      },
    });
  });
});
