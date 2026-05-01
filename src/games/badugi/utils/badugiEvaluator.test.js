import { describe, expect, it } from "vitest";
import {
  evaluateBadugi,
  evaluateHand,
  compareHands,
  evaluateAndCompare,
} from "./badugiEvaluator.js";

const card = (rank, suit) => ({ rank, suit });

describe("evaluateHand", () => {
  it("returns a 4-card Badugi with ranks sorted ascending", () => {
    const evaluated = evaluateHand([
      card(7, "D"),
      card(1, "S"),
      card(10, "C"),
      card(4, "H"),
    ]);

    expect(evaluated.count).toBe(4);
    expect(evaluated.ranks).toEqual([1, 4, 7, 10]);
    expect(evaluated.key).toEqual([4, 1, 4, 7, 10]);
  });

  it("drops conflicting suits and keeps the lexicographically best subset", () => {
    const evaluated = evaluateHand([
      card(1, "C"),
      card(6, "C"),
      card(9, "D"),
      card(4, "H"),
    ]);

    expect(evaluated.count).toBe(3);
    expect(evaluated.ranks).toEqual([1, 4, 9]);
    expect(evaluated.key).toEqual([3, 1, 4, 9, 0]);
  });

  it("keeps exactly-four-card numeric API strict", () => {
    expect(() =>
      evaluateHand([
        card(13, "C"),
        card(12, "D"),
        card(3, "H"),
        card(2, "S"),
        card(4, "C"),
      ]),
    ).toThrow(/exactly 4 cards/);
  });
});

describe("evaluateBadugi legacy API", () => {
  it("checks all subsets instead of stopping at the first 4-card candidate", () => {
    const evaluated = evaluateBadugi(["KC", "QD", "3H", "2S", "4C"]);

    expect(evaluated.count).toBe(4);
    expect(evaluated.ranks).toEqual([1, 2, 3, 11]);
    expect(evaluated.activeCards).toEqual(["2S", "3H", "4C", "QD"]);
    expect(evaluated.deadCards).toEqual(["KC"]);
  });
});

describe("compareHands", () => {
  it("prefers lower ranks when both are 4-card Badugis", () => {
    const hero = evaluateHand([
      card(1, "C"),
      card(4, "D"),
      card(7, "H"),
      card(13, "S"),
    ]);
    const villain = evaluateHand([
      card(2, "C"),
      card(5, "D"),
      card(8, "H"),
      card(13, "S"),
    ]);

    expect(compareHands(hero, villain)).toBe(1);
    expect(compareHands(villain, hero)).toBe(-1);
  });

  it("always prefers a 4-card Badugi over a 3-card Badugi", () => {
    const fourCard = evaluateHand([
      card(2, "C"),
      card(5, "D"),
      card(7, "H"),
      card(9, "S"),
    ]);
    const threeCard = evaluateHand([
      card(1, "C"),
      card(4, "C"),
      card(6, "D"),
      card(8, "H"),
    ]);

    expect(threeCard.count).toBe(3);
    expect(compareHands(fourCard, threeCard)).toBe(1);
    expect(compareHands(threeCard, fourCard)).toBe(-1);
  });

  it("orders 3-card Badugis before 2-card Badugis and handles ties", () => {
    const betterThree = evaluateHand([
      card(1, "C"),
      card(5, "D"),
      card(9, "H"),
      card(9, "S"),
    ]);
    const weakerThree = evaluateHand([
      card(2, "C"),
      card(6, "D"),
      card(10, "H"),
      card(10, "S"),
    ]);
    const twoCard = evaluateHand([
      card(3, "C"),
      card(3, "D"),
      card(11, "H"),
      card(11, "S"),
    ]);

    expect(compareHands(betterThree, weakerThree)).toBe(1);
    expect(compareHands(weakerThree, twoCard)).toBe(1);
    expect(compareHands(twoCard, weakerThree)).toBe(-1);
  });

  it("detects exact ties", () => {
    const handA = evaluateHand([
      card(1, "C"),
      card(2, "D"),
      card(3, "H"),
      card(4, "S"),
    ]);
    const handB = evaluateHand([
      card(4, "C"),
      card(3, "D"),
      card(2, "H"),
      card(1, "S"),
    ]);

    expect(compareHands(handA, handB)).toBe(0);
  });
});

describe("evaluateAndCompare", () => {
  it("evaluates raw cards before comparing", () => {
    const result = evaluateAndCompare(
      [
        card(2, "C"),
        card(4, "D"),
        card(6, "H"),
        card(8, "S"),
      ],
      [
        card(2, "C"),
        card(4, "D"),
        card(6, "H"),
        card(8, "H"), // suit clash -> drops to 3-card
      ],
    );

    expect(result).toBe(1);
  });
});
