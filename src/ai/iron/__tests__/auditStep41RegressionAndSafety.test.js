import { describe, expect, it } from "vitest";

import { summarizeStep41RegressionAndSafety } from "../auditStep41RegressionAndSafety.js";

describe("audit Step41 regression and safety", () => {
  it("passes clean targeted arenas with positive Iron-Pro gap", () => {
    const report = summarizeStep41RegressionAndSafety({
      arena: {
        results: [{ variant: "S02", ironEv: 5, proEv: 3, standardEv: 4, ironProGap: 2, illegal: 0, freeze: 0 }],
      },
      deterministic: true,
    });

    expect(report.status).toBe("PASS");
    expect(report.verdict).toBe("SAFE");
    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
  });

  it("fails illegal or frozen arenas", () => {
    const report = summarizeStep41RegressionAndSafety({
      arena: {
        results: [{ variant: "S02", ironProGap: 2, illegal: 1, freeze: 0 }],
      },
      deterministic: true,
    });

    expect(report.status).toBe("FAIL");
    expect(report.reason).toContain("illegal-action-present");
  });
});
