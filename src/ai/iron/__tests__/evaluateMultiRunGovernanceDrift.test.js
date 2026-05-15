import { describe, expect, it } from "vitest";

import { evaluateMultiRunGovernanceDrift } from "../evaluateMultiRunGovernanceDrift.js";

describe("evaluateMultiRunGovernanceDrift", () => {
  it("does not fail on sparse warn alone", () => {
    const report = evaluateMultiRunGovernanceDrift({
      history: [{ hardenedStatus: "WARN", ironProGap: { S02: 0 }, sameActionRate: 1, deterministicReplay: true }],
      rollingBaseline: { rollingDatasetHitRate: 0.0016 },
    });
    expect(report.status).toBe("WARN");
  });

  it("fails on repeated negative iron-pro gaps", () => {
    const report = evaluateMultiRunGovernanceDrift({
      history: [
        { ironProGap: { S02: -1 } },
        { ironProGap: { S02: -1 } },
        { ironProGap: { S02: -1 } },
      ],
      rollingBaseline: { rollingDatasetHitRate: 0.0016 },
    });
    expect(report.status).toBe("FAIL");
  });
});
