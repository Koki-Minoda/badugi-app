import { describe, expect, it } from "vitest";

import { summarizeStep44Safety } from "../auditStep44Safety.js";

describe("Step44 safety audit", () => {
  it("passes clean deterministic scarcity diagnosis", () => {
    const report = summarizeStep44Safety({
      step43Safety: { illegal: 0, freeze: 0 },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });

    expect(report.status).toBe("PASS");
    expect(report.verdict).toBe("SAFE");
  });
});
