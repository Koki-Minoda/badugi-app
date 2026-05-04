import { describe, expect, it } from "vitest";
import {
  compareDramahaBoard,
  compareDramahaDraw,
  evaluateDramahaHand,
} from "../utils/dramahaEvaluator.js";

describe("dramahaEvaluator", () => {
  it("evaluates the board half with Omaha exactly-two hole card usage", () => {
    const evaluation = evaluateDramahaHand({
      variant: "dramaha_hi",
      holeCards: ["AS", "AD", "KC", "QD", "2H"],
      boardCards: ["KS", "QS", "JS"],
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
      boardCards: ["AS", "KD", "QH"],
    });
    const eightLow = evaluateDramahaHand({
      variant: "dramaha_27",
      holeCards: ["8C", "5D", "4H", "3S", "2C"],
      boardCards: ["AS", "KD", "QH"],
    });

    expect(compareDramahaDraw(sevenLow, eightLow)).toBeLessThan(0);
  });

  it("keeps board and draw winners independently comparable", () => {
    const boardWinner = evaluateDramahaHand({
      variant: "dramaha_hi",
      holeCards: ["2S", "2D", "AS", "KD", "QC"],
      boardCards: ["2C", "7D", "7H"],
    });
    const drawWinner = evaluateDramahaHand({
      variant: "dramaha_hi",
      holeCards: ["AH", "KH", "QH", "JH", "10H"],
      boardCards: ["2C", "7D", "7H"],
    });

    expect(compareDramahaBoard(boardWinner, drawWinner)).toBeLessThan(0);
    expect(compareDramahaDraw(drawWinner, boardWinner)).toBeLessThan(0);
  });
});
