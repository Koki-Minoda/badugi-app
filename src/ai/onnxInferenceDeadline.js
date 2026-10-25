export const DEFAULT_ONNX_INFERENCE_TIMEOUT_MS = 8000;

// Finalize evidence together with the result; a late model response cannot
// rewrite a timeout that already selected the caller's fallback policy.
export async function runTracedOnnxInferenceWithDeadline(inference, payload, options = {}) {
  const startedAt = Date.now();
  let capturedTrace = null;
  let finalized = false;
  const result = await runOnnxInferenceWithDeadline(() => inference({
    ...payload,
    onInferenceTrace: (trace) => {
      if (!finalized) capturedTrace = { ...trace };
    },
  }), options);
  finalized = true;
  const inferenceTrace = !result.timedOut && !result.error && capturedTrace
    ? capturedTrace
    : {
        variantId: payload.variantId ?? null, tierId: payload.tierId ?? null,
        phase: payload.phase ?? null, requestedModelId: payload.modelId ?? null,
        selectedModelId: capturedTrace?.selectedModelId ?? null, usedModelId: null,
        status: result.timedOut ? "fallback" : "failed",
        reason: result.timedOut ? "inference-timeout" : result.error ? "inference-failed" : "inference-evidence-missing",
        elapsedMs: Math.max(0, Date.now() - startedAt),
      };
  return { ...result, inferenceTrace };
}

export async function runOnnxInferenceWithDeadline(
  inference,
  { timeoutMs = DEFAULT_ONNX_INFERENCE_TIMEOUT_MS } = {},
) {
  let timeoutId = null;
  const inferenceResult = Promise.resolve()
    .then(inference)
    .then((decision) => ({ decision: decision ?? null, timedOut: false, error: null }))
    .catch((error) => ({ decision: null, timedOut: false, error }));
  const timeoutResult = new Promise((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ decision: null, timedOut: true, error: null }),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([inferenceResult, timeoutResult]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export function matchesPendingOnnxInference(
  pending,
  { handId, phase, seatIndex },
) {
  return Boolean(
    pending &&
      pending.handId === handId &&
      pending.phase === phase &&
      pending.seatIndex === seatIndex,
  );
}
