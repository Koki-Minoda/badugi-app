export const RL_TRANSITION_VECTOR_SIZE = 96;
export const RL_TARGET_VARIANTS = Object.freeze(["D03", "D01", "D02", "S01", "S02"]);

const TERMINAL_ACTIONS = new Set(["collect", "showdown"]);

function normalizeAction(action) {
  return String(action ?? "").trim().toLowerCase();
}

function getVariantId(transition = {}) {
  return (
    transition.variantId ??
    transition.variant_id ??
    transition.metadata?.variantId ??
    transition.metadata?.variant_id ??
    null
  );
}

function getSchemaVersion(transition = {}) {
  return (
    transition.schemaVersion ??
    transition.schema_version ??
    transition.metadata?.schemaVersion ??
    transition.metadata?.schema_version ??
    null
  );
}

function vectorErrors(vector, fieldName, size = RL_TRANSITION_VECTOR_SIZE) {
  const errors = [];
  if (!Array.isArray(vector) && !ArrayBuffer.isView(vector)) {
    return [`missing_${fieldName}`];
  }
  const values = Array.from(vector);
  if (values.length !== size) {
    errors.push(`${fieldName}_shape_mismatch`);
  }
  values.forEach((value, index) => {
    if (!Number.isFinite(Number(value))) {
      errors.push(`${fieldName}_non_finite_${index}`);
    }
  });
  return errors;
}

function getLegalActions(transition = {}) {
  const raw = transition.legal_actions ?? transition.legalActions ?? [];
  return Array.isArray(raw) ? raw.map(normalizeAction).filter(Boolean) : [];
}

function getDrawInfo(transition = {}) {
  return transition.drawInfo ?? transition.draw_info ?? transition.metadata?.drawInfo ?? transition.metadata?.draw_info ?? {};
}

function getObjectField(transition = {}, keys = []) {
  for (const key of keys) {
    if (transition[key] && typeof transition[key] === "object") return transition[key];
    if (transition.metadata?.[key] && typeof transition.metadata[key] === "object") return transition.metadata[key];
  }
  return null;
}

function validateRewardMetadata(transition = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const rewardBySeat = getObjectField(transition, ["rewardBySeat", "reward_by_seat", "rewards", "rewardsBySeat"]);
  const stackDeltaBySeat = getObjectField(transition, ["stackDeltaBySeat", "stack_delta_by_seat", "stackDeltas"]);
  const terminal = transition.done === true;

  if (rewardBySeat) {
    let rewardSum = 0;
    for (const [seat, rawReward] of Object.entries(rewardBySeat)) {
      const reward = Number(rawReward);
      if (!Number.isFinite(reward)) {
        errors.push("reward_by_seat_not_finite");
        continue;
      }
      rewardSum += reward;
      if (stackDeltaBySeat && stackDeltaBySeat[seat] != null) {
        const stackDelta = Number(stackDeltaBySeat[seat]);
        if (!Number.isFinite(stackDelta)) {
          errors.push("stack_delta_not_finite");
        } else if (Math.abs(stackDelta - reward) > (options.rewardDeltaEpsilon ?? 0.001)) {
          errors.push("reward_stack_delta_mismatch");
        }
      }
    }
    if (terminal && options.enforceZeroSumReward !== false && Math.abs(rewardSum) > (options.rewardSumEpsilon ?? 0.001)) {
      errors.push("reward_sum_not_zero");
    }
  } else if (terminal && options.requireTerminalRewardBySeat) {
    warnings.push("missing_terminal_reward_by_seat");
  }

  const stackDelta = transition.stackDelta ?? transition.stack_delta ?? transition.metadata?.stackDelta ?? transition.metadata?.stack_delta;
  if (stackDelta != null) {
    const numericStackDelta = Number(stackDelta);
    const reward = Number(transition.reward);
    if (!Number.isFinite(numericStackDelta)) {
      errors.push("stack_delta_not_finite");
    } else if (Number.isFinite(reward) && Math.abs(numericStackDelta - reward) > (options.rewardDeltaEpsilon ?? 0.001)) {
      errors.push("reward_stack_delta_mismatch");
    }
  }

  return { errors, warnings };
}

function validateDrawMetadata(transition = {}) {
  const errors = [];
  const warnings = [];
  const action = normalizeAction(transition.action);
  if (!action.startsWith("draw_")) {
    return { errors, warnings };
  }
  const drawInfo = getDrawInfo(transition);
  const drawCount = Number(
    transition.drawCount ??
      transition.draw_count ??
      (typeof drawInfo === "object" ? drawInfo.drawCount ?? drawInfo.draw_count : null) ??
      action.replace("draw_", ""),
  );
  const discardIndexes =
    typeof drawInfo === "object"
      ? drawInfo.discardIndexes ?? drawInfo.discard_indexes ?? drawInfo.drawIndexes ?? []
      : [];

  if (!Number.isInteger(drawCount) || drawCount < 0) {
    errors.push("invalid_draw_count");
  }
  if (Array.isArray(discardIndexes)) {
    const seen = new Set();
    discardIndexes.forEach((index) => {
      const normalized = Number(index);
      if (!Number.isInteger(normalized) || normalized < 0 || normalized > 4) {
        errors.push("discard_index_out_of_range");
      }
      if (seen.has(normalized)) {
        errors.push("discard_index_duplicate");
      }
      seen.add(normalized);
    });
    if (Number.isInteger(drawCount) && discardIndexes.length > 0 && drawCount !== discardIndexes.length) {
      errors.push("draw_count_discard_indexes_mismatch");
    }
  } else {
    warnings.push("missing_discard_indexes_for_draw");
  }
  return { errors, warnings };
}

export function validateRlTransition(transition = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const vectorSize = options.vectorSize ?? RL_TRANSITION_VECTOR_SIZE;
  const variantId = getVariantId(transition);
  const schemaVersion = getSchemaVersion(transition);
  const action = normalizeAction(transition.action);
  const legalActions = getLegalActions(transition);
  const done = transition.done;
  const reward = Number(transition.reward);

  if (!variantId) errors.push("missing_variant_id");
  if (!schemaVersion) errors.push("missing_schema_version");
  errors.push(...vectorErrors(transition.observation, "observation", vectorSize));
  if (done !== true || options.requireTerminalNextObservation !== false) {
    errors.push(...vectorErrors(transition.next_observation ?? transition.nextObservation, "next_observation", vectorSize));
  }
  if (!action) errors.push("missing_action");
  if (!Array.isArray(transition.legal_actions ?? transition.legalActions)) errors.push("missing_legal_actions");
  if (!Number.isFinite(reward)) errors.push("reward_not_finite");
  if (typeof done !== "boolean") errors.push("done_not_boolean");
  if (action && legalActions.length > 0 && !legalActions.includes(action) && !TERMINAL_ACTIONS.has(action)) {
    errors.push("action_not_in_legal_actions");
  }

  const source = transition.source ?? transition.metadata?.source ?? transition.metadata?.source_kind;
  if (!source && options.requireSourceMarker !== false) {
    errors.push("missing_source_marker");
  }

  const drawValidation = validateDrawMetadata(transition);
  errors.push(...drawValidation.errors);
  warnings.push(...drawValidation.warnings);

  const rewardValidation = validateRewardMetadata(transition, options);
  errors.push(...rewardValidation.errors);
  warnings.push(...rewardValidation.warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    variantId,
    schemaVersion,
    action,
  };
}

export function summarizeRlTransitionValidation(transitions = [], options = {}) {
  const results = transitions.map((transition) => validateRlTransition(transition, options));
  const invalidReasons = {};
  for (const result of results) {
    for (const error of result.errors) {
      invalidReasons[error] = (invalidReasons[error] ?? 0) + 1;
    }
  }
  const invalid = results.filter((result) => !result.ok).length;
  return {
    total: results.length,
    valid: results.length - invalid,
    invalid,
    invalidReasons,
    trainingAllowed: invalid === 0,
    results,
  };
}
