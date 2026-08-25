import { describe, expect, it } from "vitest";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";

const engine = new AceToFiveTripleDrawEngine();

function evalHand(cards) {
  return engine.evaluateShowdownHand(cards);
}

describe("A-5 Triple Draw evaluator spec", () => {
  it("A-2-3-4-5 is the best low", () => {
    const wheel = evalHand(["AS", "2S", "3S", "4S", "5S"]);
    const sixLow = evalHand(["6S", "4D", "3C", "2H", "AS"]);

    expect(wheel.handName).toBe("A-5 Low 5-4-3-2-A");
    expect(wheel.rankPrimary).toBeLessThan(sixLow.rankPrimary);
  });

  it("ace is low", () => {
    const aceHand = evalHand(["6S", "5D", "4C", "3H", "AS"]);

    expect(aceHand.metadata.ranks).toEqual([6, 5, 4, 3, 1]);
    expect(aceHand.handName).toContain("A");
  });

  it("6-4-3-2-A beats 7-5-4-3-2", () => {
    const sixLow = evalHand(["6S", "4D", "3C", "2H", "AS"]);
    const sevenLow = evalHand(["7S", "5D", "4C", "3H", "2S"]);

    expect(sixLow.rankPrimary).toBeLessThan(sevenLow.rankPrimary);
  });

  it("straight does not penalize A-2-3-4-5", () => {
    const straightWheel = evalHand(["AS", "2D", "3C", "4H", "5S"]);

    expect(straightWheel.metadata.category).toBe("highCard");
    expect(straightWheel.metadata.penalty).toBe(0);
    expect(straightWheel.handName).toBe("A-5 Low 5-4-3-2-A");
  });

  it("flush does not penalize a clean low", () => {
    const flush = evalHand(["6S", "4S", "3S", "2S", "AS"]);

    expect(flush.metadata.category).toBe("highCard");
    expect(flush.metadata.penalty).toBe(0);
    expect(flush.handName).toBe("A-5 Low 6-4-3-2-A");
  });

  it("pair is bad", () => {
    const pair = evalHand(["7S", "7D", "4C", "3H", "2S"]);

    expect(pair.metadata.category).toBe("onePair");
    expect(pair.metadata.penalty).toBeGreaterThan(0);
  });
});
