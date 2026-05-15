import { describe, expect, it } from "vitest";

import { summarizeStep43Safety } from "../auditStep43Safety.js";

describe("Step43 safety audit", () => {
  it("passes deterministic clean mixed arena", () => {
    const report = summarizeStep43Safety({
      arena: { results: [{ variant: "S02", ironProGap: 1, illegal: 0, freeze: 0 }] },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });

    expect(report.status).toBe("PASS");
    expect(report.verdict).toBe("SAFE");
  });

  it("fails determinism break", () => {
    const report = summarizeStep43Safety({
      arena: { results: [{ variant: "S02", ironProGap: 1, illegal: 0, freeze: 0 }] },
      determinism: { deterministic: false, mismatchCount: 1, invalidReplayCount: 0 },
    });

    expect(report.status).toBe("FAIL");
    expect(report.reason).toContain("determinism-failure");
  });
});
