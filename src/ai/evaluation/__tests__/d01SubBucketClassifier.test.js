import { describe, expect, it } from "vitest";

import { classifyD01SubBucket } from "../d01SubBucketClassifier.js";

function buildSample(overrides = {}) {
  return {
    variantId: "D01",
    sampleTag: "iron-step7",
    handClass: "strong27TD",
    drawRound: 3,
    playerCount: 3,
    position: "cutoff",
    facingAction: "raise",
    actorSeat: 0,
    snapshot: {
      currentBet: 40,
      players: [
        {
          seatIndex: 0,
          betThisRound: 0,
          hand: ["8S", "4S", "2S", "3C", "5C"],
        },
      ],
    },
    ...overrides,
  };
}

describe("classifyD01SubBucket", () => {
  it("classifies a strong rough late-pressure hand into a stable sub-bucket id", () => {
    const result = classifyD01SubBucket(buildSample());
    expect(result.parentBucket).toBe("strong27TD late pressure");
    expect(result.subBucketId).toContain("strong27TD late pressure");
    expect(result.subBucketId).toContain("3way");
    expect(result.subBucketId).toContain("IP");
    expect(result.subBucketId).toContain("medium");
    expect(result.subBucketId).toContain("repeatedPressure");
    expect(result.subBucketId).toContain("finalRound");
    expect(result.subBucketId).toContain("rough");
  });

  it("detects premium smooth texture", () => {
    const result = classifyD01SubBucket(
      buildSample({
        handClass: "premium27TD",
        playerCount: 2,
        position: "button",
        facingAction: "bet",
        snapshot: {
          currentBet: 20,
          players: [
            {
              seatIndex: 0,
              betThisRound: 0,
              hand: ["8S", "6D", "4C", "3H", "2S"],
            },
          ],
        },
      }),
    );
    expect(result.parentBucket).toBe("premium27TD late pressure");
    expect(result.subBucketId).toContain("HU");
    expect(result.subBucketId).toContain("button");
    expect(result.subBucketId).toContain("small");
    expect(result.subBucketId).toContain("facingBet");
    expect(result.subBucketId).toContain("premium smooth");
  });
});

