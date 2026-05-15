import { describe, expect, it } from "vitest";

import { summarizeSmokeArenaSafety } from "../verifySmokeArenaSafety.js";

describe("summarizeSmokeArenaSafety", () => {
  it("marks clean arena and deterministic replay as safe", () => {
    const report = summarizeSmokeArenaSafety({
      arena: { results: [{ illegal: 0, freeze: 0 }, { illegal: 0, freeze: 0 }], routingChanged: false },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });

    expect(report.verdict).toBe("SAFE");
    expect(report.illegal).toBe(0);
    expect(report.freeze).toBe(0);
    expect(report.invalidReplayCount).toBe(0);
  });

  it("fails when freeze is present", () => {
    const report = summarizeSmokeArenaSafety({
      arena: { results: [{ illegal: 0, freeze: 1 }] },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });

    expect(report.verdict).toBe("FAIL");
    expect(report.reason).toContain("freeze-present");
  });
});
