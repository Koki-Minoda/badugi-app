import { describe, expect, it } from "vitest";

import { createShadowSourceAttribution } from "../createShadowSourceAttribution.js";

describe("createShadowSourceAttribution", () => {
  it("compares selected isolated row against relaxed shadow row", () => {
    const result = createShadowSourceAttribution({
      selectedRow: {
        sourceType: "verified-neighbor-v3-isolated",
        chosenBestAction: { type: "RAISE" },
        trainingWeight: 0.8,
      },
      matchedRows: [
        {
          sourceType: "verified-neighbor-v3-isolated",
          chosenBestAction: { type: "RAISE" },
          trainingWeight: 0.8,
        },
        {
          sourceType: "verified-relaxed-match",
          chosenBestAction: { type: "RAISE" },
          trainingWeight: 1,
        },
      ],
    });
    expect(result.selectedSource).toBe("verified-neighbor-v3-isolated");
    expect(result.shadowRelaxedSource).toBe("verified-relaxed-match");
    expect(result.sameAction).toBe(true);
  });
});
