import { describe, expect, it } from "vitest";

import { defineMonitorRetentionPolicy } from "../defineMonitorRetentionPolicy.js";

describe("defineMonitorRetentionPolicy", () => {
  it("returns append-only retention rules", () => {
    const policy = defineMonitorRetentionPolicy();
    expect(policy.historyAppendOnly).toBe(true);
    expect(policy.retainCompletedRuns).toBe(50);
  });
});
