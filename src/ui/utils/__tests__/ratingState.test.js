import { beforeEach, describe, expect, it } from "vitest";
import {
  loadRatingState,
  resetRatingState,
  applyMatchRatings,
  computeStyleScorePreview,
  computeRankFromRating,
} from "../ratingState.js";

function installWindowStub() {
  const store = new Map();
  global.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

describe("ratingState helpers", () => {
  beforeEach(() => {
    installWindowStub();
    resetRatingState();
  });

  it("returns default ratings when no storage exists", () => {
    const rating = loadRatingState();
    expect(rating.skillRating).toBe(1500);
    expect(rating.mixedRating).toBe(1500);
    expect(rating.globalRating).toBe(1500);
    expect(rating.styleRating).toBe(50);
  });

  it("increments skill rating after a win", () => {
    const before = loadRatingState();
    applyMatchRatings({ result: 1, opponentRating: 1500, kFactor: 32 });
    const after = loadRatingState();
    expect(after.skillRating).toBeGreaterThan(before.skillRating);
    expect(after.history.length).toBe(1);
    expect(after.globalRating).toBeGreaterThanOrEqual(after.skillRating * 0.7);
  });

  it("blends style rating with provided metrics", () => {
    const before = loadRatingState();
    applyMatchRatings({
      result: 0.5,
      opponentRating: 1550,
      styleMetrics: {
        samples: 25,
        vpip: 0.3,
        pfr: 0.18,
        aggression: 2.2,
        showdown: 0.5,
        bluff: 0.12,
      },
    });
    const after = loadRatingState();
    expect(after.styleRating).toBeGreaterThan(before.styleRating);
    expect(after.styleProfile).toBeDefined();
  });

  it("exposes preview helper for UI classifications", () => {
    const preview = computeStyleScorePreview({
      samples: 10,
      vpip: 0.15,
      pfr: 0.08,
      aggression: 1.2,
      showdown: 0.55,
      bluff: 0.03,
    });
    expect(preview.profile).toBe("NIT");
    expect(preview.score).toBeGreaterThanOrEqual(0);
    expect(preview.score).toBeLessThanOrEqual(100);
  });

  it("maps global rating to rank tiers", () => {
    const bronze = computeRankFromRating(900);
    expect(bronze.label).toBe("Bronze");
    const diamond = computeRankFromRating(2250);
    expect(diamond.label).toBe("Diamond");
    expect(diamond.nextTier?.label).toBe("Master");
    expect(diamond.progress).toBeGreaterThanOrEqual(0);
    expect(diamond.progress).toBeLessThanOrEqual(1);
  });
});
