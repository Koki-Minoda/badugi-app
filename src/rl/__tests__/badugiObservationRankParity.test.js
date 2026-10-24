import { describe, expect, it } from "vitest";
import { evaluateBadugi } from "../../games/badugi/utils/badugiEvaluator.js";
import { buildBadugiObservationPayload } from "../badugiObservationSchema.js";
import { buildDrawObservationPayload } from "../drawObservationSchema.js";

const builders = [buildBadugiObservationPayload, buildDrawObservationPayload];
const payload = (hand) => ({ state: { players: [{ hand, stack: 100 }] }, seatIndex: 0, variantId: "D03" });
const permutations = (cards) => cards.length ? cards.flatMap((card, i) => permutations(cards.filter((_, j) => i !== j)).map(rest => [card, ...rest])) : [[]];

describe("Badugi observation shape matches showdown", () => {
  for (const build of builders) {
    it(`${build.name}: preserves the best subset through every card order`, () => {
      for (const hand of permutations(["AC", "AD", "2C", "3H"])) {
        expect(build(payload(hand)).features).toMatchObject({ madeCards: 3, rankSum: 6, highestRank: 3 });
      }
    });
    it(`${build.name}: matches the production evaluator across 1000 seeded hands`, () => {
      const deck = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].flatMap(rank => [..."CDHS"].map(suit => rank + suit));
      let seed = 192;
      const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
      for (let i = 0; i < 1000; i++) {
        const remaining = [...deck];
        const hand = Array.from({ length: 4 }, () => remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
        const expected = evaluateBadugi(hand);
        expect(build(payload(hand)).features, hand.join(" ")).toMatchObject({
          madeCards: expected.count,
          rankSum: expected.ranks.reduce((sum, rank) => sum + rank + 1, 0),
          highestRank: Math.max(...expected.ranks) + 1,
        });
      }
    });
  }
  it("supports numeric engine cards and empty observations", () => {
    expect(buildBadugiObservationPayload(payload([[0, 0], [0, 1], [1, 0], [2, 2]])).features).toMatchObject({ madeCards: 3, rankSum: 6 });
    for (const build of builders) expect(build(payload([])).features).toMatchObject({ madeCards: 0, rankSum: 0, highestRank: 0 });
  });
});
