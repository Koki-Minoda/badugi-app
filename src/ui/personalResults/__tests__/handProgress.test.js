import { describe, expect, it } from "vitest";
import { getPersonalResults } from "../handProgress.js";

function hand(index, discarded = [0], options = {}) {
  return {
    handId: `h-${index}`, endedAt: index, userId: 7, variantId: "D03",
    seats: [
      { seat: 0, actions: [{ seq: 1 }] },
      { seat: 1, isHero: true, actions: [{ seq: 2 }] },
    ],
    events: [
      { type: "DRAW_ACTION", seat: 0, actionSeq: 1, drawRoundIndex: 1, discarded: [1], before: ["KC", "2C", "3D", "4H"] },
      { type: "DRAW_ACTION", seat: 1, actionSeq: 2, drawRoundIndex: 1, discarded, before: ["KC", "2C", "3D", "4H"] },
    ],
    ...options,
  };
}

describe("personal results", () => {
  it("scores legacy draw events for the actual hero and excludes known other accounts", () => {
    const inputs = [
      ...Array.from({ length: 5 }, (_, i) => hand(i)),
      hand(8, [1], { userId: 8 }),
      hand(9, [1], { guestTrial: true }),
      hand(0),
      hand(10, [1], { endedAt: null }),
    ];
    const [result] = getPersonalResults(inputs, 7);
    expect(result).toMatchObject({
      id: "badugi", hands: 5, score: 10, samples: 5,
      axes: [{ score: 10, samples: 5, baseline: null }, { score: null }, { score: null }],
    });
  });

  it("keeps missing measurements distinct from zero and compares disjoint windows", () => {
    const hands = Array.from({ length: 100 }, (_, i) => hand(i, i < 50 ? [1] : [0]));
    const [game] = getPersonalResults(hands, 7);
    expect(game.timeline.map(({ score }) => score)).toEqual([0, 10]);
    expect(game.axes[0]).toEqual({ score: 10, samples: 50, baseline: 0 });
    expect(getPersonalResults(hands.slice(0, 51), 7)[0].axes[0].baseline).toBeNull();
  });
});
