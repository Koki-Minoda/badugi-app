import { describe, expect, it } from "vitest";
import {
  buildReplayReviewContract,
  isReplayReviewContract,
  REPLAY_REVIEW_CONTRACT_TYPE,
} from "../replayReviewContract.js";

describe("replayReviewContract", () => {
  it("builds a tournament replay review from a key hand without numeric strategy claims", () => {
    const contract = buildReplayReviewContract({
      reviewMode: "tournament",
      keyHand: {
        handId: "mtt-hand-1",
        reason: "bust-hand",
        title: "Bust hand",
        description: "トーナメント終了につながった最終局面です。",
        variantId: "badugi",
        phase: "BET",
        heroAction: "call",
        replayRef: {
          handId: "mtt-hand-1",
          target: { handId: "mtt-hand-1", actionSeqStart: 3, actionSeqEnd: 3 },
          available: true,
        },
      },
    });

    expect(isReplayReviewContract(contract)).toBe(true);
    expect(contract).toMatchObject({
      contractType: REPLAY_REVIEW_CONTRACT_TYPE,
      reviewMode: "tournament",
      handId: "mtt-hand-1",
      reason: "bust-hand",
      title: "Bust hand",
      variantId: "badugi",
      phase: "BET",
      heroAction: "call",
      severity: "high",
    });
    expect(contract.summary).toContain("トーナメント終了");
    expect(contract.tags).toContain("badugi");
    const phrase = (...codes) => String.fromCharCode(...codes);
    const forbiddenClaims = new RegExp(
      [
        `${phrase(101, 120, 97, 99, 116)} ${phrase(69, 86)}`,
        phrase(71, 84, 79),
        `${phrase(80, 114, 111)} ${phrase(98, 97, 115, 101, 108, 105, 110, 101)}`,
      ].join("|"),
      "i",
    );
    expect(JSON.stringify(contract)).not.toMatch(forbiddenClaims);
  });

  it("keeps cash replay reviews free of tournament placement and payout fields", () => {
    const contract = buildReplayReviewContract({
      reviewMode: "cash",
      keyHand: {
        situationId: "B-01",
        handId: "cash-hand-30",
        reason: "showdown",
        variantId: "D01",
        street: "SHOWDOWN",
        heroAction: "call",
        replayTarget: { handId: "cash-hand-30", actionSeqStart: 4 },
      },
    });

    expect(isReplayReviewContract(contract)).toBe(true);
    expect(contract.reviewMode).toBe("cash");
    expect(contract.tags).toEqual(expect.arrayContaining(["cash", "showdown", "2-7"]));
    expect(contract.improvements.join(" ")).toContain("straight trap");
    expect(contract).not.toHaveProperty("placement");
    expect(contract).not.toHaveProperty("payout");
    expect(contract).not.toHaveProperty("bustHand");
  });

  it("adds A-5 specific language for ace-to-five variants", () => {
    const contract = buildReplayReviewContract({
      reviewMode: "cash",
      keyHand: {
        handId: "a5-hand",
        reason: "draw-decision",
        variantId: "D02",
        street: "DRAW",
        heroAction: "draw",
      },
    });

    expect(contract.tags).toEqual(expect.arrayContaining(["a-5", "wheel-pressure", "smooth-low"]));
    expect(contract.positives.join(" ")).toContain("wheel pressure");
  });
});
