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

    expect(decision).toMatchObject({ action: "CALL", source: "onnx" });
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

    expect(decision).toEqual({ drawCount: 2, source: "onnx" });
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
