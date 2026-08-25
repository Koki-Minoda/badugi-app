import { describe, expect, it } from "vitest";
import {
  getCpuCharacterById,
  getCpuCharacterByName,
  getCpuCharacterForIndex,
  getCpuDisplayName,
  getCpuRoster,
} from "../cpuRoster.js";

describe("cpuRoster", () => {
  it("provides stable character names instead of numbered CPU labels", () => {
    expect(getCpuRoster().length).toBeGreaterThanOrEqual(18);
    expect(getCpuDisplayName(0)).toBe("Akira");
    expect(getCpuDisplayName(5)).toBe("Jun");
  });

  it("wraps indexes deterministically for larger tournaments", () => {
    expect(getCpuCharacterForIndex(18).name).toBe(getCpuCharacterForIndex(0).name);
  });

  it("resolves roster avatar metadata by display name for UI fallback", () => {
    expect(getCpuCharacterByName("Sora")?.avatarUrl).toBe("/characters/sora.png");
    expect(getCpuCharacterByName("unknown")).toBeNull();
  });

  it("resolves roster metadata by stable id", () => {
    expect(getCpuCharacterById("mina")).toMatchObject({
      name: "Mina",
      style: "tight-aggressive",
    });
    expect(getCpuCharacterById("unknown")).toBeNull();
  });
});
