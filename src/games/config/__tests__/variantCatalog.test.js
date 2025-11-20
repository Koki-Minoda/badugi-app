import { describe, expect, it } from "vitest";
import {
  GAME_VARIANTS,
  GAME_VARIANT_CATEGORIES,
  getVariantById,
  getVariantsByCategory,
  getEngineTemplateContext,
  listVariantsForPhase,
  ENGINE_PRIORITY_PHASES,
} from "../variantCatalog.js";
import { getVariantProfile, resolveGameProfile } from "../variantProfiles.js";

const EXPECTED_COUNTS = Object.freeze({
  [GAME_VARIANT_CATEGORIES.BOARD]: 9,
  [GAME_VARIANT_CATEGORIES.TRIPLE_DRAW]: 7,
  [GAME_VARIANT_CATEGORIES.SINGLE_DRAW]: 7,
  [GAME_VARIANT_CATEGORIES.DRAMAHA]: 6,
  [GAME_VARIANT_CATEGORIES.STUD]: 6,
});

describe("variantCatalog", () => {
  it("tracks every variant exactly once", () => {
    const ids = new Set();
    GAME_VARIANTS.forEach((variant) => {
      expect(ids.has(variant.id)).toBe(false);
      ids.add(variant.id);
    });
    expect(ids.size).toBe(35);
  });

  it("maintains expected counts per category", () => {
    Object.entries(EXPECTED_COUNTS).forEach(([category, expected]) => {
      const entries = getVariantsByCategory(category);
      expect(entries.length).toBe(expected);
    });
  });

  it("flags Badugi as implemented and skips regeneration", () => {
    const badugi = getVariantById("D03");
    expect(badugi).not.toBeNull();
    expect(badugi.status).toBe("live");
    expect(badugi.regenerationEligible).toBe(false);
  });

  it("produces engine template context", () => {
    const ctx = getEngineTemplateContext("D04");
    expect(ctx).toMatchObject({
      engineId: "d04",
      category: GAME_VARIANT_CATEGORIES.TRIPLE_DRAW,
      holeCards: 4,
      drawRounds: 3,
    });
    expect(Array.isArray(ctx.evaluators)).toBe(true);
    expect(ctx.implemented).toBe(false);
  });

  it("lists phase variants without duplicates", () => {
    ENGINE_PRIORITY_PHASES.forEach((phase) => {
      const phaseList = listVariantsForPhase(phase.phase);
      const uniqueIds = new Set(phaseList.map((variant) => variant.id));
      expect(phaseList.length).toBe(uniqueIds.size);
    });
  });

  it("produces variant profiles with requirement metadata", () => {
    const profile = getVariantProfile("D03");
    expect(profile).not.toBeNull();
    expect(profile.summary).toContain("4 cards");
    expect(profile.requirements?.needsDrawEngine).toBe(true);
  });

  it("resolves default game profiles per category", () => {
    const gameProfile = resolveGameProfile("D03");
    expect(gameProfile).toMatchObject({
      id: "D03",
      startingStack: expect.any(Number),
      forcedBets: expect.any(Object),
    });
    expect(gameProfile.startingStack).toBeGreaterThan(0);
  });
});
