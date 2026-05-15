import { describe, expect, it } from "vitest";

import {
  buildStep55PreviewHistoryEntries,
  buildVariantAwareCoachingHistorySummary,
  normalizeCoachingHistoryEntry,
  UNKNOWN_VARIANT_ID,
} from "../coachingHistoryStore.js";

describe("variant-aware coaching history", () => {
  it("migrates missing variants to unknownVariant", () => {
    const entry = normalizeCoachingHistoryEntry({ lessonId: "x" });
    expect(entry.variantId).toBe(UNKNOWN_VARIANT_ID);
  });

  it("preserves variant IDs and deterministic ordering", () => {
    const report = buildVariantAwareCoachingHistorySummary({
      entries: [
        { lessonId: "b", variantId: "S02", timestamp: "2026-05-15T04:00:00.000Z" },
        { lessonId: "a", variantId: "D02", timestamp: "2026-05-15T04:00:00.000Z" },
      ],
    });
    expect(report.entries.map((entry) => entry.lessonId)).toEqual(["a", "b"]);
    expect(report.variants).toEqual(["D02", "S02"]);
  });

  it("adds non-S02 preview tournament lessons without duplicating IDs", () => {
    const entries = buildStep55PreviewHistoryEntries({
      baseEntries: [{ lessonId: "S02_A", variantId: "S02", lessonTag: "missed-value" }],
    });
    expect(new Set(entries.map((entry) => entry.variantId))).toEqual(new Set(["D02", "S02"]));
  });
});
