import { describe, expect, it, vi } from "vitest";
import {
  matchesPendingOnnxInference,
  runOnnxInferenceWithDeadline,
} from "../onnxInferenceDeadline.js";

describe("ONNX inference deadline", () => {
  it("returns the inference result before the deadline", async () => {
    await expect(
      runOnnxInferenceWithDeadline(async () => ({ action: "CALL" }), {
        timeoutMs: 100,
      }),
    ).resolves.toEqual({
      decision: { action: "CALL" },
      timedOut: false,
      error: null,
    });
  });

  it("returns a traceable timeout instead of waiting forever", async () => {
    vi.useFakeTimers();
    const resultPromise = runOnnxInferenceWithDeadline(
      () => new Promise(() => {}),
      { timeoutMs: 8000 },
    );
    await vi.advanceTimersByTimeAsync(8000);
    await expect(resultPromise).resolves.toEqual({
      decision: null,
      timedOut: true,
      error: null,
    });
    vi.useRealTimers();
  });

  it("matches only the active hand, phase, and seat", () => {
    const pending = { handId: "hand-1", phase: "BET", seatIndex: 3 };
    expect(matchesPendingOnnxInference(pending, pending)).toBe(true);
    expect(
      matchesPendingOnnxInference(pending, {
        handId: "hand-2",
        phase: "BET",
        seatIndex: 3,
      }),
    ).toBe(false);
    expect(
      matchesPendingOnnxInference(pending, {
        handId: "hand-1",
        phase: "DRAW",
        seatIndex: 3,
      }),
    ).toBe(false);
    expect(
      matchesPendingOnnxInference(pending, {
        handId: "hand-1",
        phase: "BET",
        seatIndex: 4,
      }),
    ).toBe(false);
  });
});
