import { describe, expect, test } from "vitest";
import {
  ChinesePokerController,
  autoArrangeChineseHand,
} from "../../chinese/ChinesePokerController.js";
import {
  listVariantsByFamily,
  VARIANT_FAMILIES,
} from "./runVariantFamilyScenario.js";

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
  "10C",
  "10D",
  "10S",
  "JC",
  "JD",
];

function createChineseProgressController() {
  return new ChinesePokerController({
    seats: [
      { id: "hero", name: "You", isHero: true },
      { id: "cpu", name: "CPU" },
    ],
    deck: [...HERO_13, ...CPU_13, ...EXTRA_CARDS].filter(
      (card, idx, all) => all.indexOf(card) === idx,
    ),
    shuffle: false,
  });
}

function assertChineseSnapshot(snapshot, { expectedPhase, expectedHandId }) {
  expect(snapshot.game).toBe("chinese_poker");
  expect(snapshot.phase).toBe(expectedPhase);
  expect(snapshot.handId).toBe(expectedHandId);
  expect(snapshot.players).toHaveLength(2);
  expect(snapshot.players[0].hand).toHaveLength(13);
  expect(snapshot.players[0].rows.front).toHaveLength(3);
  expect(snapshot.players[0].rows.middle).toHaveLength(5);
  expect(snapshot.players[0].rows.back).toHaveLength(5);
  expect(snapshot.players[1].rows.front).toHaveLength(3);
  expect(snapshot.players[1].rows.middle).toHaveLength(5);
  expect(snapshot.players[1].rows.back).toHaveLength(5);
}

describe("MGX Chinese/OFC family progress coverage", () => {
  test("CP1 is classified as the Chinese family", () => {
    const variants = listVariantsByFamily(VARIANT_FAMILIES.CHINESE, {
      includeUnimplemented: true,
    });
    expect(variants.map((variant) => variant.id)).toContain("CP1");
  });

  test("CP1 set -> showdown -> next hand preserves row state and hand identity", () => {
    const controller = createChineseProgressController();

    let snapshot = controller.startNewHand();
    assertChineseSnapshot(snapshot, { expectedPhase: "set", expectedHandId: 1 });
    expect(snapshot.players[1].hand).toHaveLength(0);
    expect(snapshot.players[1].ready).toBe(true);

    const heroRows = autoArrangeChineseHand(snapshot.players[0].hand);
    snapshot = controller.setRows("hero", heroRows);
    expect(snapshot.players[0].ready).toBe(true);

    snapshot = controller.resolveShowdown();
    assertChineseSnapshot(snapshot, { expectedPhase: "showdown", expectedHandId: 1 });
    expect(snapshot.players[1].hand).toHaveLength(13);
    expect(snapshot.results?.matchups).toHaveLength(1);
    expect(snapshot.results?.totals).toEqual(
      expect.objectContaining({ hero: expect.any(Number), cpu: expect.any(Number) }),
    );

    const next = controller.nextHand();
    assertChineseSnapshot(next, { expectedPhase: "set", expectedHandId: 2 });
    expect(next.results).toBe(null);
    expect(next.players[1].hand).toHaveLength(0);
    expect(next.players[1].ready).toBe(true);
  });
});
