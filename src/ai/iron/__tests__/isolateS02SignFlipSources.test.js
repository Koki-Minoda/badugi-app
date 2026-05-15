import { describe, expect, it } from "vitest";

import { isolateS02SignFlipSources } from "../isolateS02SignFlipSources.js";
import { step28Rows } from "./s02CounterfactualFixtures.js";

describe("isolateS02SignFlipSources", () => {
  it("groups sign flips by forensic axis", () => {
    const report = isolateS02SignFlipSources({ rows: step28Rows });

    expect(report.rows).toContainEqual(
      expect.objectContaining({ axis: "position", bucket: "small-blind", sample: 4, verdict: "LOW_SAMPLE" }),
    );
    expect(report.rows.find((row) => row.axis === "drawRound" && row.bucket === "draw-0").signFlipRate).toBe(0);
  });
});
