import { describe, expect, it } from "vitest";
import { runCore5CpuVsCpuSanity } from "../../../scripts/run-core5-cpu-vs-cpu-sanity.js";

describe("Core5 CPU strategy sanity", () => {
  it("draw-lowball CPU simulation produces voluntary non-fold actions", () => {
    const { summary } = runCore5CpuVsCpuSanity({
      variantList: ["D01", "D02", "S01", "S02"],
      hands: 3,
      seats: 6,
      mode: "cash",
      cpu: "heuristic",
    });

    for (const result of summary.results) {
      expect(result.handsCompleted).toBe(3);
      expect(result.invalidActions).toBe(0);
      expect(result.freezes).toBe(0);
    }
    for (const variantId of ["D01", "D02", "S01", "S02"]) {
      const bucket = summary.decisionSummary.byVariant[variantId];
      expect(bucket.decisions).toBeGreaterThan(0);
      expect(bucket.legalRaiseSpots).toBeGreaterThan(0);
      expect(bucket.raises).toBeGreaterThan(0);
      expect(bucket.calls + bucket.checks).toBeGreaterThan(0);
      expect(bucket.foldRate).toBeLessThan(0.8);
      expect(bucket.fallbackRate).toBe(0);
    }
  });

  it("reports Badugi as browser-trace-only in the Node runner", () => {
    const { summary } = runCore5CpuVsCpuSanity({
      variantList: ["badugi"],
      hands: 2,
      seats: 6,
      mode: "cash",
      cpu: "heuristic",
    });

    expect(summary.results[0]).toMatchObject({
      variantId: "badugi",
      skipped: true,
    });
    expect(summary.results[0].skipReason).toMatch(/Playwright/i);
  });
});
