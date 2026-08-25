import { test, expect } from "@playwright/test";
import { runCore5CpuVsCpuSanity } from "../../scripts/run-core5-cpu-vs-cpu-sanity.js";

test("Core5 draw-lowball CPUs do not fold every openable cash spot", async () => {
  const { summary } = runCore5CpuVsCpuSanity({
    variantList: ["D01", "D02", "S01", "S02"],
    hands: 10,
    seats: 6,
    mode: "cash",
    cpu: "heuristic",
  });

  for (const result of summary.results) {
    expect(result.handsCompleted, `${result.variantId} hands completed`).toBe(10);
    expect(result.invalidActions, `${result.variantId} invalid action count`).toBe(0);
    expect(result.freezes, `${result.variantId} freeze count`).toBe(0);
  }

  for (const variantId of ["D01", "D02", "S01", "S02"]) {
    const bucket = summary.decisionSummary.byVariant[variantId];
    expect(bucket.decisions, `${variantId} decisions`).toBeGreaterThan(0);
    expect(bucket.legalRaiseSpots, `${variantId} legal raise spots`).toBeGreaterThan(0);
    expect(bucket.raises, `${variantId} raise/open count`).toBeGreaterThan(0);
    expect(bucket.calls + bucket.checks, `${variantId} continue count`).toBeGreaterThan(0);
    expect(bucket.foldRate, `${variantId} fold rate`).toBeLessThan(0.8);
    expect(bucket.fallbackRate, `${variantId} fallback rate`).toBe(0);
  }
});
