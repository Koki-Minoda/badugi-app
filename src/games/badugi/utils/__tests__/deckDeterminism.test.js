import { describe, expect, it } from "vitest";
import { createDeterministicRng } from "../../../testing/deterministicRng.js";
import { DeckManager } from "../deck.js";

function drawSequence(seed, count = 12) {
  const deck = new DeckManager({ rng: createDeterministicRng(seed) });
  deck.reset();
  return deck.draw(count);
}

describe("DeckManager deterministic shuffle path", () => {
  it("replays the same shuffled cards for the same seed", () => {
    expect(drawSequence("repeatable-session")).toEqual(drawSequence("repeatable-session"));
  });

  it("changes the shuffled cards when the seed changes", () => {
    expect(drawSequence("session-a")).not.toEqual(drawSequence("session-b"));
  });
});
