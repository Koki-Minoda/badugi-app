import { describe, expect, it, vi } from "vitest";
import { createDeterministicRng } from "../../../testing/deterministicRng.js";
import { DeckManager } from "../deck.js";

function drawSequence(seed, count = 12) {
  const deck = new DeckManager({ rng: createDeterministicRng(seed) });
  deck.reset();
  return deck.draw(count);
}

describe("DeckManager deterministic shuffle path", () => {
  it("keeps full deck snapshots opt-in", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const quietDeck = new DeckManager({ rng: createDeterministicRng("quiet") });
      quietDeck.reset();
      quietDeck.draw(4);
      expect(log).not.toHaveBeenCalled();

      const debugDeck = new DeckManager({
        debug: true,
        rng: createDeterministicRng("debug"),
      });
      debugDeck.reset();
      expect(log).toHaveBeenCalledWith(
        "[DECK][STATE]",
        expect.objectContaining({ label: "[RESET]" }),
      );
    } finally {
      log.mockRestore();
    }
  });

  it("replays the same shuffled cards for the same seed", () => {
    expect(drawSequence("repeatable-session")).toEqual(drawSequence("repeatable-session"));
  });

  it("changes the shuffled cards when the seed changes", () => {
    expect(drawSequence("session-a")).not.toEqual(drawSequence("session-b"));
  });
});
