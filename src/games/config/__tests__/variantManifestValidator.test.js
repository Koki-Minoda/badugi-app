import { describe, expect, it } from "vitest";
import {
  KNOWN_VARIANT_MANIFEST_EXCEPTIONS,
  auditVariantManifest,
  buildCanonicalVariantManifest,
} from "../variantManifestValidator.js";

describe("canonical variant manifest validator", () => {
  it("joins all runtime registries around the 37-entry catalog", () => {
    const manifest = buildCanonicalVariantManifest();
    expect(manifest).toHaveLength(37);
    expect(new Set(manifest.map((entry) => entry.id))).toHaveProperty("size", 37);
  });

  it("rejects every unclassified registry or definition inconsistency", () => {
    const audit = auditVariantManifest();
    expect(audit.unexpectedIssues, JSON.stringify(audit.unexpectedIssues, null, 2)).toEqual([]);
    expect(audit.allowlistedIssues.length).toBeGreaterThan(0);
    audit.allowlistedIssues.forEach((issue) => {
      expect(issue.reason).toEqual(expect.any(String));
      expect(issue.reason.length).toBeGreaterThan(20);
    });
  });

  it("keeps known debt explicit and rejects stale exception keys", () => {
    const audit = auditVariantManifest();
    expect(new Set(audit.allowlistedIssues.map((issue) => issue.key))).toEqual(
      new Set(Object.keys(KNOWN_VARIANT_MANIFEST_EXCEPTIONS)),
    );
  });

  it("keeps canonical Hold'em and Omaha hole-card counts aligned", () => {
    const manifest = buildCanonicalVariantManifest();
    expect(manifest.find((entry) => entry.id === "B01")).toMatchObject({
      holeCards: 2,
      definitionHoleCards: 2,
    });
    expect(manifest.find((entry) => entry.id === "B09")).toMatchObject({
      holeCards: 4,
    });
  });
});
