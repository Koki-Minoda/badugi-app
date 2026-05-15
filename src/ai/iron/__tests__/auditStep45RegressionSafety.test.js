import { describe, expect, it } from "vitest";

import { summarizeStep45RegressionSafety } from "../auditStep45RegressionSafety.js";

describe("auditStep45RegressionSafety", () => {
  it("passes when illegal/freeze are clear and Iron-Pro is not catastrophic", () => {
    const report = summarizeStep45RegressionSafety({
      arena: {
        results: [
          { variant: "D02", ironEv: 2, proEv: 1, standardEv: 0, ironProGap: 1, illegal: 0, freeze: 0 },
          { variant: "S01", ironEv: 3, proEv: 1, standardEv: 0, ironProGap: 2, illegal: 0, freeze: 0 },
          { variant: "S02", ironEv: 4, proEv: 1, standardEv: 0, ironProGap: 3, illegal: 0, freeze: 0 },
        ],
      },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });
    expect(report.status).toBe("PASS");
    expect(report.allIronProPositive).toBe(true);
  });
});
