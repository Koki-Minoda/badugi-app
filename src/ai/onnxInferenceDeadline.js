export const DEFAULT_ONNX_INFERENCE_TIMEOUT_MS = 8000;

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
