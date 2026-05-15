import { describe, expect, it } from "vitest";

import { auditS02EntropySources } from "../auditS02EntropySources.js";
import { focusedReportFixture } from "./s02CounterfactualFixtures.js";

describe("auditS02EntropySources", () => {
  it("classifies focused entropy from action and context distributions", () => {
    const report = auditS02EntropySources({ focusedReport: focusedReportFixture });

    expect(report.classification).toBe("UNEXPORTABLE");
    expect(report.sources).toContainEqual(expect.objectContaining({ source: "actionDistributionEntropy" }));
  });
});
