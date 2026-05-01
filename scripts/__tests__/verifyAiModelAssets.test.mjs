import { describe, expect, it } from "vitest";
import { verifyAiModelAssets } from "../verifyAiModelAssets.mjs";

describe("verifyAiModelAssets", () => {
  it("accepts installed required ONNX assets and does not fail optional missing assets", () => {
    const strictReport = verifyAiModelAssets({ allowMissing: false });
    expect(strictReport.failures).toEqual([]);
    expect(strictReport.failures.some((entry) => entry.status === "missing-optional")).toBe(false);
    expect(strictReport.results.find((entry) => entry.id === "model-badugi-pro-v1")?.status).toBe("ok");
    expect(strictReport.results.find((entry) => entry.id === "model-badugi-iron-v1")?.status).toBe("ok");
    expect(strictReport.results.find((entry) => entry.id === "model-badugi-worldmaster-v1")?.status).toBe("ok");

    const fallbackReport = verifyAiModelAssets({ allowMissing: true });
    expect(fallbackReport.failures).toEqual([]);
  });
});
