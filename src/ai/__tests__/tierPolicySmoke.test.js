import { describe, expect, it } from "vitest";
import { runBadugiTierPolicySmoke } from "../tierPolicySmoke.js";

describe("Badugi tier policy smoke", () => {
  it("keeps stronger tiers more aggressive while avoiding extra made-hand draws", () => {
    const summary = runBadugiTierPolicySmoke({
      tierIds: ["beginner", "standard", "pro", "worldmaster"],
      iterations: 160,
      seed: 7,
    });
    const byTier = Object.fromEntries(summary.map((entry) => [entry.tierId, entry]));

    expect(byTier.beginner.raiseRate).toBeLessThan(byTier.pro.raiseRate);
    expect(byTier.standard.raiseRate).toBeLessThanOrEqual(byTier.worldmaster.raiseRate);
    expect(byTier.pro.madeBadugiPatRate).toBeGreaterThanOrEqual(byTier.beginner.madeBadugiPatRate);
    expect(byTier.worldmaster.averageDrawCount).toBeLessThanOrEqual(byTier.beginner.averageDrawCount);
  });
});
