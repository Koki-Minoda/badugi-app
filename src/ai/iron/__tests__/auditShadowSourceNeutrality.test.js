import { describe, expect, it } from "vitest";

import { auditShadowSourceNeutrality } from "../auditShadowSourceNeutrality.js";

describe("auditShadowSourceNeutrality", () => {
  it("normalizes shadow neutrality rows", async () => {
    const rows = await auditShadowSourceNeutrality({
      auditRows: [
        {
          decisionId: "d1",
          selectedSource: "verified-neighbor-v3-isolated",
          shadowSelectedSource: "verified-relaxed-match",
          sameAction: true,
          sourceSpecificityDelta: 10.5,
        },
      ],
      outputPath: "/tmp/step21-neutrality-audit.json",
    });
    expect(rows[0].shadowSource).toBe("verified-relaxed-match");
    expect(rows[0].sameAction).toBe(true);
  });
});
