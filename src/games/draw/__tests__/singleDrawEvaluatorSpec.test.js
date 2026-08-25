import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

const s01 = new DeuceToSevenSingleDrawEngine();
const s02 = new AceToFiveSingleDrawEngine();

describe("Single Draw evaluator spec", () => {
  it("S01 7-5-4-3-2 unsuited beats 8-low", () => {
    const wheel = s01.evaluateShowdownHand(["7S", "5D", "4C", "3H", "2S"]);
    const eightLow = s01.evaluateShowdownHand(["8S", "6D", "5C", "3S", "2C"]);

    expect(wheel.handName).toBe("2-7 Low 7-5-4-3-2");
    expect(wheel.rankPrimary).toBeLessThan(eightLow.rankPrimary);
  });

  it("S01 ace is high, not low", () => {
    const aceHand = s01.evaluateShowdownHand(["AS", "7D", "5C", "4H", "2S"]);

    expect(aceHand.metadata.ranks[0]).toBe(14);
    expect(aceHand.handName).toContain("A");
  });

  it("S01 straight, flush, and pair are bad", () => {
    const straight = s01.evaluateShowdownHand(["7S", "6D", "5C", "4H", "3S"]);
    const flush = s01.evaluateShowdownHand(["8S", "6S", "5S", "3S", "2S"]);
    const pair = s01.evaluateShowdownHand(["7S", "7D", "4C", "3H", "2S"]);

    expect(straight.metadata.penalty).toBeGreaterThan(0);
    expect(flush.metadata.penalty).toBeGreaterThan(0);
    expect(pair.metadata.penalty).toBeGreaterThan(0);
  });

  it("S02 A-2-3-4-5 is best", () => {
    const wheel = s02.evaluateShowdownHand(["AS", "2S", "3S", "4S", "5S"]);
    const sixLow = s02.evaluateShowdownHand(["6S", "4D", "3C", "2H", "AS"]);

    expect(wheel.handName).toBe("A-5 Low 5-4-3-2-A");
    expect(wheel.rankPrimary).toBeLessThan(sixLow.rankPrimary);
  });

  it("S02 ace is low and 6-4-3-2-A beats 7-5-4-3-2", () => {
    const sixLow = s02.evaluateShowdownHand(["6S", "4D", "3C", "2H", "AS"]);
    const sevenLow = s02.evaluateShowdownHand(["7S", "5D", "4C", "3H", "2S"]);

    expect(sixLow.metadata.ranks).toEqual([6, 4, 3, 2, 1]);
    expect(sixLow.rankPrimary).toBeLessThan(sevenLow.rankPrimary);
  });

  it("S02 straight and flush are ignored, while pair remains bad", () => {
    const straight = s02.evaluateShowdownHand(["AS", "2D", "3C", "4H", "5S"]);
    const flush = s02.evaluateShowdownHand(["6S", "4S", "3S", "2S", "AS"]);
    const pair = s02.evaluateShowdownHand(["7S", "7D", "4C", "3H", "2S"]);

    expect(straight.metadata.penalty).toBe(0);
    expect(flush.metadata.penalty).toBe(0);
    expect(pair.metadata.penalty).toBeGreaterThan(0);
  });
});
