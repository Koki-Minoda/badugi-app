import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

const engine = new DeuceToSevenTripleDrawEngine();

function evalHand(cards) {
  return engine.evaluateShowdownHand(cards);
}

describe("2-7 Triple Draw evaluator spec", () => {
  it("7-5-4-3-2 unsuited beats 8-low", () => {
    const sevenPerfect = evalHand(["7S", "5D", "4C", "3H", "2S"]);
    const eightLow = evalHand(["8S", "6D", "4C", "3H", "2S"]);

    expect(sevenPerfect.handName).toBe("2-7 Low 7-5-4-3-2");
    expect(sevenPerfect.rankPrimary).toBeLessThan(eightLow.rankPrimary);
  });

  it("ace is high, not low", () => {
    const aceHand = evalHand(["6S", "5D", "4C", "3H", "AS"]);

    expect(aceHand.metadata.ranks[0]).toBe(14);
    expect(aceHand.handName).toContain("A");
  });

  it("straight is bad", () => {
    const straight = evalHand(["7S", "6D", "5C", "4H", "3S"]);

    expect(straight.metadata.category).toBe("straight");
    expect(straight.metadata.penalty).toBeGreaterThan(0);
  });

  it("flush is bad", () => {
    const flush = evalHand(["7S", "5S", "4S", "3S", "2S"]);

    expect(flush.metadata.category).toBe("flush");
    expect(flush.metadata.penalty).toBeGreaterThan(0);
  });

  it("pair is bad", () => {
    const pair = evalHand(["7S", "7D", "4C", "3H", "2S"]);

    expect(pair.metadata.category).toBe("onePair");
    expect(pair.metadata.penalty).toBeGreaterThan(0);
  });
});

