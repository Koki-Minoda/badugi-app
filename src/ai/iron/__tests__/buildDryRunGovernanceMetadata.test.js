import { describe, expect, it } from "vitest";

import { buildDryRunGovernanceMetadata } from "../buildDryRunGovernanceMetadata.js";

describe("buildDryRunGovernanceMetadata", () => {
  it("keeps dry-run governance non-promotable", () => {
    const metadata = buildDryRunGovernanceMetadata();
    expect(metadata.candidateTier).toBe("iron-dryrun");
    expect(metadata.promotionEligible).toBe(false);
    expect(metadata.promoted).toBe(false);
    expect(metadata.routingChanged).toBe(false);
    expect(metadata.priorityFrozen).toBe(true);
  });
});
