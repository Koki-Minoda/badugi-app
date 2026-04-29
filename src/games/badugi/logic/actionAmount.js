function normalizeNumeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeBetActionAmount({
  actionType,
  amount,
  toCall = 0,
  unit = 1,
} = {}) {
  const normalizedType = String(actionType ?? "").toUpperCase();
  const normalizedToCall = Math.max(0, Math.trunc(Number(toCall) || 0));
  const normalizedUnit = Math.max(1, Math.trunc(Number(unit) || 1));
  const normalizedAmount = normalizeNumeric(amount);

  if (normalizedType === "CHECK" || normalizedType === "FOLD" || normalizedType === "DRAW") {
    return {
      isValid: true,
      schema: "none",
      contribution: 0,
      raiseIncrement: 0,
      requestedAmount: normalizedAmount,
    };
  }

  if (normalizedType === "CALL") {
    if (normalizedAmount == null) {
      return {
        isValid: true,
        schema: "implicit-to-call",
        contribution: normalizedToCall,
        raiseIncrement: 0,
        requestedAmount: null,
      };
    }
    if (normalizedAmount === normalizedToCall) {
      return {
        isValid: true,
        schema: "call-contribution",
        contribution: normalizedToCall,
        raiseIncrement: 0,
        requestedAmount: normalizedAmount,
      };
    }
    return {
      isValid: false,
      code: "FL_CALL_MISMATCH",
      message: "Call amount must match to-call exactly",
      requestedAmount: normalizedAmount,
      expectedAmount: normalizedToCall,
    };
  }

  if (normalizedType === "BET" || normalizedType === "RAISE") {
    const expectedContribution = normalizedToCall + normalizedUnit;

    if (normalizedAmount == null) {
      return {
        isValid: true,
        schema: "implicit-contribution",
        contribution: expectedContribution,
        raiseIncrement: normalizedUnit,
        requestedAmount: null,
      };
    }
    if (normalizedAmount === normalizedUnit) {
      return {
        isValid: true,
        schema: "raise-increment",
        contribution: expectedContribution,
        raiseIncrement: normalizedUnit,
        requestedAmount: normalizedAmount,
      };
    }
    if (normalizedAmount === expectedContribution) {
      return {
        isValid: true,
        schema: "raise-contribution",
        contribution: expectedContribution,
        raiseIncrement: normalizedUnit,
        requestedAmount: normalizedAmount,
      };
    }
    return {
      isValid: false,
      code: "FL_RAISE_AMOUNT",
      message: "Raise amount is not aligned with fixed-limit unit schema",
      requestedAmount: normalizedAmount,
      expectedIncrement: normalizedUnit,
      expectedContribution,
    };
  }

  if (normalizedType === "ALL-IN") {
    const explicit = normalizedAmount == null ? 0 : Math.max(0, normalizedAmount);
    return {
      isValid: true,
      schema: normalizedAmount == null ? "all-in-stack" : "all-in-explicit",
      contribution: normalizedToCall + explicit,
      raiseIncrement: Math.max(0, explicit),
      requestedAmount: normalizedAmount,
    };
  }

  return {
    isValid: true,
    schema: "none",
    contribution: 0,
    raiseIncrement: 0,
    requestedAmount: normalizedAmount,
  };
}
