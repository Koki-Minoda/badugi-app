import { describe, expect, it } from "vitest";
import { verifyAiModelAssets } from "../verifyAiModelAssets.mjs";

describe("verifyAiModelAssets", () => {
  it("reports missing production ONNX assets while allowing local fallback smoke", () => {
    const strictReport = verifyAiModelAssets({ allowMissing: false });
    expect(strictReport.failures.some((entry) => entry.id === "model-badugi-pro-v1")).toBe(true);
    expect(strictReport.failures.some((entry) => entry.status === "missing-required")).toBe(true);

    const fallbackReport = verifyAiModelAssets({ allowMissing: true });
    expect(fallbackReport.failures).toEqual([]);
    expect(fallbackReport.results.some((entry) => entry.status === "missing-required")).toBe(true);
  });
});
