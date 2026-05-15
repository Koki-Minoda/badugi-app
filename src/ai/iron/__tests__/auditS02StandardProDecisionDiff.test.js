import { describe, expect, it } from "vitest";

import { auditS02StandardProDecisionDiff } from "../auditS02StandardProDecisionDiff.js";
import { step28Rows } from "./s02CounterfactualFixtures.js";

describe("auditS02StandardProDecisionDiff", () => {
  it("explains Standard CALL over Pro FOLD differences", () => {
    const report = auditS02StandardProDecisionDiff({ rows: step28Rows });

    expect(report.decisions[0]).toEqual(
      expect.objectContaining({ pair: "CALL/FOLD", interpretation: "Standard continuation over Pro overfold" }),
    );
  });
});
