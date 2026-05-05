import { describe, expect, it } from "vitest";
import {
  ChinesePokerController,
  autoArrangeChineseHand,
} from "../ChinesePokerController.js";

const HERO_13 = [
  "AS",
  "AD",
  "AC",
  "KS",
  "KD",
  "QS",
  "QH",
  "QD",
  "9C",
  "9D",
  "8S",
  "7H",
  "2C",
];

const CPU_13 = [
  "AH",
  "KH",
  "QH",
  "JH",
  "10H",
  "9S",
  "9H",
  "9D",
  "4C",
  "4D",
  "3S",
  "3H",
  "2D",
];

const EXTRA_CARDS = [
  "2S",
  "2H",
  "3C",
  "3D",
  "4S",
  "4H",
  "5C",
  "5D",
  "5S",
  "5H",
  "6C",
  "6D",
  "6S",
  "6H",
  "7C",
  "7D",
  "7S",
  "8C",
  "8D",
  "8H",
  "9H",
  "10C",
  "10D",
  "10S",
  "JC",
  "JD",
];

function createController() {
  return new ChinesePokerController({
    seats: [
      { id: "hero", name: "You", isHero: true },
      { id: "cpu", name: "CPU" },
    ],
    deck: [...HERO_13, ...CPU_13, ...EXTRA_CARDS].filter(
      (card, idx, all) => all.indexOf(card) === idx
    ),
    shuffle: false,
  });
}

describe("ChinesePokerController", () => {
  it("deals 13 cards and auto-arranges rows without fouling", () => {
    const arranged = autoArrangeChineseHand(HERO_13);

    expect(arranged.front).toHaveLength(3);
    expect(arranged.middle).toHaveLength(5);
    expect(arranged.back).toHaveLength(5);
    expect(arranged.evaluation.foul).toBe(false);
  });

  it("starts a hand with hidden opponent hand and ready CPU rows", () => {
    const controller = createController();
    const snapshot = controller.startNewHand();

    expect(snapshot.phase).toBe("set");
    expect(snapshot.players).toHaveLength(2);
    expect(snapshot.players[0].hand).toHaveLength(13);
    expect(snapshot.players[1].hand).toHaveLength(0);
    expect(snapshot.players[1].ready).toBe(true);
    expect(snapshot.players[1].rows.back).toHaveLength(5);
  });

  it("rejects row sets that do not use exactly the player's 13 unique cards", () => {
    const controller = createController();
    controller.startNewHand();

    expect(() =>
      controller.setRows("hero", {
        front: HERO_13.slice(0, 3),
        middle: HERO_13.slice(3, 8),
        back: HERO_13.slice(7, 12),
      })
    ).toThrow(/13 unique cards/);
  });

  it("detects a hero foul during showdown scoring", () => {
    const controller = createController();
    controller.startNewHand();
    controller.setRows("hero", {
      front: ["AS", "AD", "AC"],
      middle: ["KS", "KD", "QS", "QH", "2C"],
      back: ["QD", "9C", "9D", "8S", "7H"],
    });
    const snapshot = controller.resolveShowdown();
    const matchup = snapshot.results.matchups[0];

    expect(snapshot.phase).toBe("showdown");
    expect(snapshot.players[0].evaluation.foul).toBe(true);
    expect(matchup.foul).toBe("hero");
    expect(snapshot.results.totals.hero).toBeLessThan(0);
  });

  it("resolves row points, royalties, and next hand transitions", () => {
    const controller = createController();
    let snapshot = controller.startNewHand();
    const heroRows = snapshot.players[0].rows;
    controller.setRows("hero", heroRows);

    snapshot = controller.resolveShowdown();
    expect(snapshot.results.matchups[0].rows).toEqual(
      expect.objectContaining({ front: expect.any(Number), middle: expect.any(Number), back: expect.any(Number) })
    );
    expect(snapshot.players[1].hand).toHaveLength(13);

    const next = controller.nextHand();
    expect(next.handId).toBe(2);
    expect(next.phase).toBe("set");
    expect(next.results).toBe(null);
  });
});
