import { afterEach, describe, expect, it } from "vitest";
import {
  appendHandHistoryAction,
  finalizeHandHistoryRecord,
  resetHandHistoryRecord,
  startHandHistoryRecord,
} from "../handHistory.js";
import {
  getHandHistoryReplayRequirements,
  validateReplayReadyHandHistory,
} from "../handHistoryReplayRequirements.js";

describe("handHistory", () => {
  afterEach(() => {
    resetHandHistoryRecord();
  });

  it("keeps Badugi as the default hand history variant", () => {
    startHandHistoryRecord({
      handId: "badugi-hand",
      seats: [{ seat: 0, name: "Hero", startStack: 500 }],
    });

    const record = finalizeHandHistoryRecord({
      players: [{ stack: 600, hand: ["AS", "2H", "3D", "4C"] }],
      pots: [
        {
          potIndex: 0,
          potAmount: 100,
          payouts: [{ seatIndex: 0, payout: 100, hand: ["AS", "2H", "3D", "4C"] }],
        },
      ],
    });

    expect(record.variantId).toBe("badugi");
    expect(record.seats[0].evaluation).toMatchObject({ count: 4 });
    expect(record.seats[0].finalLowRanks).toBeUndefined();
  });

  it("records D01 draw metadata and final 2-7 low ranks", () => {
    const finalHand = ["7S", "5D", "4C", "3H", "2S"];
    startHandHistoryRecord({
      handId: "d01-hand",
      variantId: "D01",
      variantName: "2-7 Triple Draw",
      seats: [{ seat: 0, name: "Hero", startStack: 500 }],
    });

    appendHandHistoryAction({
      seat: 0,
      street: "DRAW",
      type: "draw",
      metadata: {
        drawInfo: {
          drawCount: 2,
          drawIndexes: [3, 4],
          keptCards: ["7S", "5D", "4C"],
          replacedCards: [
            { index: 3, oldCard: "KH", newCard: "3H" },
            { index: 4, oldCard: "QS", newCard: "2S" },
          ],
        },
      },
    });

    const record = finalizeHandHistoryRecord({
      players: [{ stack: 600, hand: finalHand }],
      pots: [
        {
          potIndex: 0,
          potAmount: 100,
          payouts: [{ seatIndex: 0, payout: 100, hand: finalHand }],
        },
      ],
    });

    expect(record.variantId).toBe("D01");
    expect(record.variantName).toBe("2-7 Triple Draw");
    expect(record.seats[0].actions[0]).toMatchObject({
      street: "DRAW",
      type: "draw",
      drawCount: 2,
      discarded: [3, 4],
      keptCards: ["7S", "5D", "4C"],
    });
    expect(record.seats[0].actions[0].replacedCards).toEqual([
      { index: 3, oldCard: "KH", newCard: "3H" },
      { index: 4, oldCard: "QS", newCard: "2S" },
    ]);
    expect(record.seats[0].handLabel).toBe("2-7 Low 7-5-4-3-2");
    expect(record.seats[0].finalLowRanks).toEqual([7, 5, 4, 3, 2]);
    expect(record.pots[0].winners[0].handLabel).toBe("2-7 Low 7-5-4-3-2");
    expect(record.pots[0].winners[0].finalLowRanks).toEqual([7, 5, 4, 3, 2]);
  });

  it.each([
    {
      variantId: "D02",
      variantName: "A-5 Triple Draw",
      hand: ["AS", "2S", "3S", "4S", "5S"],
      label: "A-5 Low 5-4-3-2-A",
      ranks: [5, 4, 3, 2, 1],
    },
    {
      variantId: "S01",
      variantName: "2-7 Single Draw",
      hand: ["7S", "5D", "4C", "3H", "2S"],
      label: "2-7 Low 7-5-4-3-2",
      ranks: [7, 5, 4, 3, 2],
    },
    {
      variantId: "S02",
      variantName: "A-5 Single Draw",
      hand: ["AS", "2S", "3S", "4S", "5S"],
      label: "A-5 Low 5-4-3-2-A",
      ranks: [5, 4, 3, 2, 1],
    },
  ])("records $variantId final lowball labels and ranks", ({ variantId, variantName, hand, label, ranks }) => {
    startHandHistoryRecord({
      handId: `${variantId}-hand`,
      variantId,
      variantName,
      seats: [{ seat: 0, name: "Hero", startStack: 500 }],
    });

    const record = finalizeHandHistoryRecord({
      players: [{ stack: 600, hand }],
      pots: [
        {
          potIndex: 0,
          potAmount: 100,
          payouts: [{ seatIndex: 0, payout: 100, hand }],
        },
      ],
    });

    expect(record.variantId).toBe(variantId);
    expect(record.variantName).toBe(variantName);
    expect(record.seats[0].handLabel).toBe(label);
    expect(record.seats[0].finalLowRanks).toEqual(ranks);
    expect(record.pots[0].winners[0].handLabel).toBe(label);
    expect(record.pots[0].winners[0].finalLowRanks).toEqual(ranks);
  });

  it("records S03 high-draw hand labels without lowball ranks", () => {
    const hand = ["AS", "AH", "AD", "AC", "2S"];
    startHandHistoryRecord({
      handId: "s03-hand",
      variantId: "S03",
      variantName: "5-Card Single Draw",
      seats: [{ seat: 0, name: "Hero", startStack: 500 }],
    });

    const record = finalizeHandHistoryRecord({
      players: [{ stack: 620, hand }],
      pots: [
        {
          potIndex: 0,
          potAmount: 120,
          payouts: [{ seatIndex: 0, payout: 120, hand }],
        },
      ],
    });

    expect(record.variantId).toBe("S03");
    expect(record.variantName).toBe("5-Card Single Draw");
    expect(record.seats[0].handLabel).toBe("Four of a Kind");
    expect(record.seats[0].evaluation).toMatchObject({
      handName: "Four of a Kind",
      metadata: { category: "four-of-a-kind" },
    });
    expect(record.seats[0].finalLowRanks).toBeUndefined();
    expect(record.pots[0].winners[0].handLabel).toBe("Four of a Kind");
    expect(record.pots[0].winners[0].finalLowRanks).toBeUndefined();
  });

  it.each([
    {
      variantId: "D04",
      variantName: "Badeucey TD",
      hand: ["AS", "2D", "3C", "4H", "7S"],
      labelPart: "2-7 Low",
    },
    {
      variantId: "D05",
      variantName: "Badacey TD",
      hand: ["AS", "2D", "3C", "4H", "5S"],
      labelPart: "A-5 Low",
    },
    {
      variantId: "D06",
      variantName: "Hidugi TD",
      hand: ["KS", "QD", "JH", "10C"],
      labelPart: "Badugi",
    },
    {
      variantId: "S04",
      variantName: "Badugi Single Draw",
      hand: ["AS", "2D", "3C", "4H"],
      labelPart: "Badugi",
    },
  ])("records $variantId special draw hand labels", ({ variantId, variantName, hand, labelPart }) => {
    startHandHistoryRecord({
      handId: `${variantId}-history`,
      variantId,
      variantName,
      seats: [{ seat: 0, name: "Hero", startStack: 500 }],
    });

    const record = finalizeHandHistoryRecord({
      players: [{ stack: 620, hand }],
      pots: [
        {
          potIndex: 0,
          potAmount: 120,
          payouts: [{ seatIndex: 0, payout: 120, hand }],
        },
      ],
    });

    expect(record.variantId).toBe(variantId);
    expect(record.variantName).toBe(variantName);
    expect(record.seats[0].handLabel).toContain(labelPart);
    expect(record.pots[0].winners[0].handLabel).toContain(labelPart);
  });

  it("defines and validates the minimum D01 replay fields", () => {
    const finalHand = ["7S", "5D", "4C", "3H", "2S"];
    startHandHistoryRecord({
      handId: "d01-replay-ready",
      variantId: "D01",
      variantName: "2-7 Triple Draw",
      seats: [{ seat: 0, name: "Hero", startStack: 500 }],
    });
    appendHandHistoryAction({
      seat: 0,
      street: "DRAW",
      type: "draw",
      metadata: {
        drawInfo: {
          drawCount: 1,
          drawIndexes: [4],
          keptCards: ["7S", "5D", "4C", "3H"],
          replacedCards: [{ index: 4, oldCard: "KS", newCard: "2S" }],
        },
      },
    });
    const record = finalizeHandHistoryRecord({
      players: [{ stack: 600, hand: finalHand }],
      pots: [
        {
          potIndex: 0,
          potAmount: 100,
          payouts: [{ seatIndex: 0, payout: 100, hand: finalHand }],
        },
      ],
    });

    const requirements = getHandHistoryReplayRequirements("D01");
    expect(requirements.drawAction).toEqual(
      expect.arrayContaining(["drawCount", "discarded", "keptCards", "replacedCards"]),
    );
    expect(requirements.winner).toEqual(
      expect.arrayContaining(["handLabel", "finalLowRanks"]),
    );
    expect(validateReplayReadyHandHistory(record, { variantId: "D01" })).toMatchObject({
      valid: true,
      missing: [],
    });

    const incomplete = {
      ...record,
      seats: [{ ...record.seats[0], actions: [{ seq: 1, street: "DRAW", type: "draw" }] }],
    };
    const validation = validateReplayReadyHandHistory(incomplete, { variantId: "D01" });
    expect(validation.valid).toBe(false);
    expect(validation.missing).toEqual(
      expect.arrayContaining([
        "record.seats[0].actions[0].drawCount",
        "record.seats[0].actions[0].discarded",
        "record.seats[0].actions[0].keptCards",
        "record.seats[0].actions[0].replacedCards",
      ]),
    );
  });
});
