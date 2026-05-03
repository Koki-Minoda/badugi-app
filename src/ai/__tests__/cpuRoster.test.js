import { describe, expect, it } from "vitest";
import { getCpuCharacterForIndex, getCpuDisplayName, getCpuRoster } from "../cpuRoster.js";

describe("cpuRoster", () => {
  it("provides stable character names instead of numbered CPU labels", () => {
    expect(getCpuRoster().length).toBeGreaterThanOrEqual(18);
    expect(getCpuDisplayName(0)).toBe("Akira");
    expect(getCpuDisplayName(5)).toBe("Jun");
  });

  it("wraps indexes deterministically for larger tournaments", () => {
    expect(getCpuCharacterForIndex(18).name).toBe(getCpuCharacterForIndex(0).name);
  });
});
