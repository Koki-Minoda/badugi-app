export function buildControllerRaiseFallbackPayload(attempt, toCall, rejectionCode = null) {
  const finalAction = toCall === 0 ? "check" : "call";
  const reason = rejectionCode
    ? `controller-rejected-raise:${rejectionCode}`
    : "controller-rejected-raise";
  const attemptedTrace = attempt?.inferenceTrace ?? {};
  return {
    ...attempt,
    type: finalAction,
    amount: toCall,
    action: finalAction,
    selectedAction: "raise",
    finalAction,
    __forceInstant: true,
    inferenceTrace: {
      ...attemptedTrace,
      usedModelId: null,
      status: "fallback",
      reason,
    },
    decisionSource: "controller-raise-fallback",
    fallbackReason: reason,
    fallbackReasonCategory: "CONTROLLER_REJECTED_RAISE",
    illegalActionRejected: true,
  };
}
