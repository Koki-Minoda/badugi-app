import { beforeEach, describe, expect, it, vi } from "vitest";

const runMock = vi.fn();

vi.mock("../onnxExecutor.js", () => ({
  getOrt: vi.fn(async () => ({
    Tensor: class Tensor {
      constructor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    },
  })),
  getOrCreateSession: vi.fn(async (entry) => {
    if (entry?.id === "missing-model") return null;
    return {
      inputNames: ["input"],
      outputNames: ["output"],
      run: runMock,
    };
  }),
}));

vi.mock("../modelRouter.js", () => ({
  selectModelForVariant: vi.fn(({ tierId }) => {
    if (tierId === "unconfigured") return null;
    if (tierId === "missing") {
      return {
        id: "missing-model",
        inputShape: [96],
        outputShape: [6],
        onnx: "models/missing.onnx",
      };
    }
    if (tierId === "bad-shape") {
      return {
        id: "bad-shape-model",
        inputShape: [95],
        outputShape: [6],
        onnx: "models/bad.onnx",
      };
    }
    return {
      id: "available-model",
      inputShape: [96],
      outputShape: [6],
      onnx: "models/available.onnx",
    };
  }),
}));

const { inferBetActionWithOnnx, inferDrawDecisionWithOnnx } = await import("../onnxPolicyAdapter.js");

describe("onnxPolicyAdapter inference fallback", () => {
  beforeEach(() => {
    runMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns an ONNX action when a model session is available", async () => {
    runMock.mockResolvedValueOnce({ output: { data: [0.1, 0.2, 0.9, 0.3, 0.4, 0.5] } });

    const decision = await inferBetActionWithOnnx({
      variantId: "D03",
      tierId: "iron",
      state: {
        street: "BET",
        players: [{ hand: ["AS", "2D", "3C", "4H"], stack: 500 }],
      },
      legalActions: ["fold", "check", "call", "raise"],
    });

    expect(decision).toMatchObject({
      action: "CALL",
      source: "onnx",
      modelId: "available-model",
    });
  });

  it("masks illegal ONNX bet outputs instead of remapping by modulo", async () => {
    runMock.mockResolvedValueOnce({ output: { data: [0.1, 0.2, 0.3, 0.4, 0.7, 0.9] } });

    const decision = await inferBetActionWithOnnx({
      variantId: "D03",
      tierId: "iron",
      state: {
        street: "BET",
        players: [{ hand: ["AS", "2D", "3C", "4H"], stack: 500 }],
      },
      legalActions: ["fold", "call", "raise"],
    });

    expect(decision).toMatchObject({ action: "RAISE", source: "onnx" });
  });

  it("decodes draw ONNX outputs through draw action labels and legal actions", async () => {
    runMock.mockResolvedValueOnce({
      output: { data: [0.1, 0.2, 0.3, 0.4, 0.5, 0.05, 0.1, 0.95, 0.7, 0.2, 0.1] },
    });

    const decision = await inferDrawDecisionWithOnnx({
      variantId: "D01",
      tierId: "iron",
      state: {
        street: "DRAW",
        players: [{ hand: ["2S", "2H", "9C", "KD", "QS"], stack: 500 }],
      },
      legalActions: ["draw_0", "draw_1", "draw_2", "draw_3"],
    });

    expect(decision).toMatchObject({ drawCount: 2, source: "onnx" });
  });

  it("decodes Badugi's phase-dependent six outputs as pat through draw three", async () => {
    runMock.mockResolvedValueOnce({
      output: { data: [0.1, 0.2, 0.95, 0.4, 9.0, 8.0] },
    });

    const decision = await inferDrawDecisionWithOnnx({
      variantId: "D03",
      tierId: "standard",
      observation: {
        state: {
          variantId: "D03",
          street: "DRAW",
          players: [{ hand: ["AS", "2D", "3C", "4H"], stack: 500 }],
        },
        seatIndex: 0,
        legalActions: ["draw_0", "draw_1", "draw_2", "draw_3"],
      },
      legalActions: ["draw_0", "draw_1", "draw_2", "draw_3"],
    });

    expect(decision).toMatchObject({
      drawCount: 2,
      source: "onnx",
      modelId: "available-model",
    });
  });

  it("returns null when no model session is available", async () => {
    await expect(
      inferBetActionWithOnnx({
        variantId: "D03",
        tierId: "missing",
        state: { players: [{ hand: ["AS", "2D", "3C", "4H"] }] },
      }),
    ).resolves.toBeNull();
  });

  it("returns null for invalid model input shape", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      inferBetActionWithOnnx({
        variantId: "D03",
        tierId: "bad-shape",
        state: { players: [{ hand: ["AS", "2D", "3C", "4H"] }] },
      }),
    ).resolves.toBeNull();
  });
});


describe("request-scoped inference evidence", () => {
  it("distinguishes an unconfigured model from inference failure", async () => {
    const onInferenceTrace = vi.fn();
    expect(await inferBetActionWithOnnx({ variantId: "D03", tierId: "unconfigured", onInferenceTrace })).toBeNull();
    expect(onInferenceTrace).toHaveBeenCalledWith(expect.objectContaining({ status: "not-configured", reason: "model-not-configured", selectedModelId: null, usedModelId: null }));
  });

  it("does not count deterministic fallback for unusable scores as learned action usage", async () => {
    runMock.mockResolvedValueOnce({ output: { data: [NaN, NaN, NaN, NaN] } });
    const onInferenceTrace = vi.fn();
    const result = await inferBetActionWithOnnx({ variantId: "D03", tierId: "iron", legalActions: ["CALL"], onInferenceTrace });
    expect(result.action).toBe("CALL");
    expect(onInferenceTrace).toHaveBeenCalledWith(expect.objectContaining({ status: "fallback", reason: "no-legal-policy-score", usedModelId: null }));
  });

  it.each([
    ["missing", "session-unavailable"],
    ["bad-shape", "feature-build-failed"],
  ])("records %s without claiming a model was used", async (tierId, reason) => {
    const onInferenceTrace = vi.fn();
    await inferBetActionWithOnnx({ variantId: "D03", tierId, legalActions: ["CALL"], onInferenceTrace });
    expect(onInferenceTrace).toHaveBeenCalledWith(expect.objectContaining({
      variantId: "D03", tierId, phase: "BET", status: "failed", reason, usedModelId: null,
      selectedModelId: tierId === "missing" ? "missing-model" : "bad-shape-model",
      elapsedMs: expect.any(Number),
    }));
  });

  it("records successful usage without private observations", async () => {
    runMock.mockResolvedValueOnce({ output: { data: [0.1, 0.2, 0.9, 0.3, 0.4, 0.5] } });
    const onInferenceTrace = vi.fn();
    const decision = await inferBetActionWithOnnx({ variantId: "D03", tierId: "iron", modelId: "requested", legalActions: ["CALL"], observation: { privateCards: ["AS"] }, onInferenceTrace });
    expect(decision.modelId).toBe("available-model");
    expect(onInferenceTrace).toHaveBeenCalledTimes(1);
    expect(onInferenceTrace.mock.calls[0][0]).toMatchObject({ requestedModelId: "requested", selectedModelId: "available-model", usedModelId: "available-model", status: "used", reason: null, phase: "BET" });
    expect(JSON.stringify(onInferenceTrace.mock.calls[0][0])).not.toContain("privateCards");
  });

  it("records inference exceptions and cannot let a diagnostic callback break fallback", async () => {
    runMock.mockRejectedValueOnce(new Error("injected inference fault"));
    const traces = [];
    const result = await inferDrawDecisionWithOnnx({ variantId: "D03", tierId: "iron", legalActions: ["draw_0"], onInferenceTrace: trace => { traces.push(trace); throw new Error("diagnostic sink failed"); } });
    expect(result).toBeNull();
    expect(traces).toEqual([expect.objectContaining({ phase: "DRAW", reason: "inference-failed", usedModelId: null })]);
  });
});
