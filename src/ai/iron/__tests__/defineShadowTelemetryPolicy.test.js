import { describe, expect, it } from "vitest";

import { defineShadowTelemetryPolicy } from "../defineShadowTelemetryPolicy.js";

describe("defineShadowTelemetryPolicy", () => {
  it("keeps relaxed source shadow-only", () => {
    const policy = defineShadowTelemetryPolicy();
    expect(policy.shadowTelemetryEnabled).toBe(true);
    expect(policy.relaxedSourceSelectable).toBe(false);
    expect(policy.relaxedSourceShadowOnly).toBe(true);
    expect(policy.priorityFrozen).toBe(true);
  });
});
