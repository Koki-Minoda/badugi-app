import { describe, expect, it } from "vitest";
import {
  compareDramahaBoard,
  compareDramahaDraw,
  evaluateDramahaHand,
  getDramahaVariantConfig,
} from "../utils/dramahaEvaluator.js";

describe("dramahaEvaluator", () => {
  it("evaluates the board half with Omaha exactly-two hole card usage", () => {
    const evaluation = evaluateDramahaHand({
      variant: "dramaha_hi",
      holeCards: ["AS", "AD", "KC", "QD", "2H"],
      boardCards: ["KS", "QS", "JS", "9C", "8D"],
    });

    expect(evaluation.board.mustUseHoleCards).toBe(2);
    expect(evaluation.board.mustUseBoardCards).toBe(3);
    expect(evaluation.board.holeCardsUsed).toHaveLength(2);
    expect(evaluation.board.boardCardsUsed).toHaveLength(3);
    expect(evaluation.draw.handName).not.toBe("Invalid");
  });

  it("compares Dramaha 2-7 draw halves as lowball hands", () => {
    const sevenLow = evaluateDramahaHand({
      variant: "dramaha_27",
      holeCards: ["7C", "5D", "4H", "3S", "2C"],
      boardCards: ["AS", "KD", "QH", "9C", "8D"],
    });
    const eightLow = evaluateDramahaHand({
      variant: "dramaha_27",
      holeCards: ["8C", "5D", "4H", "3S", "2C"],
      boardCards: ["AS", "KD", "QH", "9C", "8D"],
    });

    expect(compareDramahaDraw(sevenLow, eightLow)).toBeLessThan(0);
  });

  it("keeps board and draw winners independently comparable", () => {
    const boardWinner = evaluateDramahaHand({
      variant: "dramaha_hi",
      holeCards: ["2S", "2D", "AS", "KD", "QC"],
      boardCards: ["2C", "7D", "7H", "9C", "JD"],
    });
    const drawWinner = evaluateDramahaHand({
      variant: "dramaha_hi",
      holeCards: ["AH", "KH", "QH", "JH", "10H"],
      boardCards: ["2C", "7D", "7H", "9C", "JD"],
    });

    expect(compareDramahaBoard(boardWinner, drawWinner)).toBeLessThan(0);
    expect(compareDramahaDraw(drawWinner, boardWinner)).toBeLessThan(0);
  });

  it("scores Dramaha Zero using face cards as zero and ace as one", () => {
    const perfectZero = evaluateDramahaHand({
      variant: "dramaha_zero",
      holeCards: ["JC", "QD", "KH", "JS", "QC"],
      boardCards: ["2C", "7D", "7H", "9C", "JD"],
    });
    const wheel = evaluateDramahaHand({
      variant: "dramaha_zero",
      holeCards: ["AS", "2D", "3H", "4C", "5S"],
      boardCards: ["2C", "7D", "7H", "9C", "JD"],
    });
    const highPoints = evaluateDramahaHand({
      variant: "dramaha_zero",
      holeCards: ["10S", "10D", "10H", "10C", "9S"],
      boardCards: ["2C", "7D", "7H", "9C", "JD"],
    });

    expect(perfectZero.draw.metadata).toMatchObject({
      zeroScore: 0,
      pointValues: [0, 0, 0, 0, 0],
    });
    expect(wheel.draw.metadata.zeroScore).toBe(15);
    expect(highPoints.draw.metadata.zeroScore).toBe(49);
    expect(compareDramahaDraw(perfectZero, wheel)).toBeLessThan(0);
    expect(compareDramahaDraw(wheel, highPoints)).toBeLessThan(0);
  });

  it("publishes the rules-specific draw caps for every Dramaha variant", () => {
    expect(getDramahaVariantConfig("dramaha_hi").maxDiscard).toBe(5);
    expect(getDramahaVariantConfig("dramaha_27").maxDiscard).toBe(5);
    expect(getDramahaVariantConfig("dramaha_a5").maxDiscard).toBe(5);
    expect(getDramahaVariantConfig("dramaha_zero").maxDiscard).toBe(3);
    expect(getDramahaVariantConfig("dramaha_hidugi").maxDiscard).toBe(3);
    expect(getDramahaVariantConfig("dramaha_badugi").maxDiscard).toBe(3);
  });
});
