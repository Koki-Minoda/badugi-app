import { describe, expect, it } from "vitest";
import {
  evaluateBadugi,
  compareBadugi,
  getWinnersByBadugi,
} from "../src/games/badugi/utils/badugiEvaluator.js";

const rankSymbols = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

describe("Badugi evaluator", () => {
  it("recognizes the wheel as the best possible Badugi", () => {
    const evalResult = evaluateBadugi(["AC", "2D", "3H", "4S"]);
    expect(evalResult.count).toBe(4);
    expect(evalResult.activeCards).toEqual(["AC", "2D", "3H", "4S"]);
    expect(evalResult.deadCards).toEqual([]);
    expect(evalResult.rankType).toBe("BADUGI");
  });

  it("prefers lower high-card in four-card comparisons", () => {
    const wheel = evaluateBadugi(["AC", "2D", "3H", "4S"]);
    const fiveHigh = evaluateBadugi(["2C", "3D", "4H", "5S"]);
    expect(compareBadugi(wheel, fiveHigh)).toBeLessThan(0);
    expect(compareBadugi(fiveHigh, wheel)).toBeGreaterThan(0);
  });

  it("drops higher duplicates of the same suit", () => {
    const result = evaluateBadugi(["AS", "2D", "3D", "4H"]);
    expect(result.count).toBe(3);
    expect(result.activeCards).toEqual(["AS", "2D", "4H"]);
    expect(result.deadCards).toEqual(["3D"]);
  });

  it("drops duplicate ranks, keeping the lower-ranked card", () => {
    const result = evaluateBadugi(["4S", "4D", "7H", "KC"]);
    expect(result.count).toBe(3);
    expect(result.activeCards).toEqual(["4D", "7H", "KC"]);
    expect(result.deadCards).toEqual(["4S"]);
  });

  it("handles multiple duplicates across suits and ranks", () => {
    const result = evaluateBadugi(["AC", "2C", "3D", "4D"]);
    expect(result.count).toBe(2);
    expect(result.activeCards).toEqual(["AC", "3D"]);
    expect(result.deadCards).toEqual(["2C", "4D"]);
  });

  it("always ranks any four-card Badugi ahead of any three-card hand", () => {
    const threeCard = ["AC", "2D", "3H", "3S"];
    const fourCard = ["2C", "4D", "6H", "8S"];
    expect(compareBadugi(threeCard, fourCard)).toBeGreaterThan(0);
    expect(compareBadugi(fourCard, threeCard)).toBeLessThan(0);
  });

  it("detects perfect ties", () => {
    const handA = ["AC", "3D", "5H", "7S"];
    const handB = ["AS", "3C", "5D", "7H"];
    expect(compareBadugi(handA, handB)).toBe(0);
  });

  it("returns multiple winners when hands tie", () => {
    const players = [
      { seat: 0, name: "Hero", hand: ["AC", "3D", "5H", "7S"] },
      { seat: 1, name: "CPU 1", hand: ["AS", "3C", "5D", "7H"] },
      { seat: 2, name: "CPU 2", hand: ["2C", "4D", "6H", "9S"] },
    ];
    const winners = getWinnersByBadugi(players);
    const winnerSeats = winners.map((winner) => winner.seat).sort();
    expect(winnerSeats).toEqual([0, 1]);
  });

  it("regression: Dai high-card showdown case", () => {
    const heroHand = ["2C", "4D", "6H", "8S"];
    const daiHand = ["KD", "QD", "7C", "3S"]; // duplicate diamonds -> only a 3-card Badugi
    expect(compareBadugi(heroHand, daiHand)).toBeLessThan(0);
    const winners = getWinnersByBadugi([
      { seat: 0, seatIndex: 0, name: "Hero", hand: heroHand },
      { seat: 1, seatIndex: 1, name: "Dai", hand: daiHand },
    ]);
    expect(winners.map((entry) => entry.name)).toEqual(["Hero"]);
  });

  it("identifies dead cards and ordering for the provided scenarios", () => {
    const cases = [
      {
        hand: ["AC", "2D", "3H", "4S"],
        expectedActive: ["AC", "2D", "3H", "4S"],
        expectedDead: [],
      },
      {
        hand: ["AS", "2D", "3D", "4H"],
        expectedActive: ["AS", "2D", "4H"],
        expectedDead: ["3D"],
      },
      {
        hand: ["4S", "4D", "7H", "KC"],
        expectedActive: ["4D", "7H", "KC"],
        expectedDead: ["4S"],
      },
      {
        hand: ["AC", "2C", "3D", "4D"],
        expectedActive: ["AC", "3D"],
        expectedDead: ["2C", "4D"],
      },
    ];
    for (const { hand, expectedActive, expectedDead } of cases) {
      const result = evaluateBadugi(hand);
      expect(result.activeCards).toEqual(expectedActive);
      expect(result.deadCards).toEqual(expectedDead);
    }
  });

  it("exposes rank metadata in ascending order", () => {
    const evaluation = evaluateBadugi(["AC", "4D", "7H", "KS"]);
    const symbols = evaluation.ranks.map((value) => rankSymbols[value]);
    expect(symbols).toEqual(["A", "4", "7", "K"]);
  });
});
