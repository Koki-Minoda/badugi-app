import { selectModelForVariant } from "./modelRouter.js";
import { getOrCreateSession, getOrt } from "./onnxExecutor.js";
import {
  BADUGI_OBSERVATION_VECTOR_SIZE,
  BADUGI_RL_ACTIONS,
  BADUGI_RL_FALLBACK_PRIORITY,
  buildBadugiObservationVector,
  chooseDeterministicSafeAction,
} from "../rl/badugiObservationSchema.js";
import {
  DRAW_OBSERVATION_VECTOR_SIZE,
  buildDrawObservationVector,
  isDrawRlVariant,
} from "../rl/drawObservationSchema.js";

function toFloat32Array(length, builder) {
  const vector = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    vector[i] = builder(i);
  }
  return vector;
}

function flattenShape(shape) {
  if (!Array.isArray(shape) || shape.length === 0) {
    return 0;
  }
  return shape.reduce((acc, val) => acc * val, 1);
}

function expectedInputLength(entry) {
  return flattenShape(entry?.inputShape) || BADUGI_OBSERVATION_VECTOR_SIZE;
}

function getLegalActions(payload = {}) {
  return (Array.isArray(payload.legalActions) ? payload.legalActions : [])
    .map((action) => String(action).toUpperCase())
    .filter(Boolean);
}

export function buildBadugiOnnxFeatures(entry, payload = {}) {
  const vector = buildBadugiObservationVector(payload.observation ?? payload);
  const expectedLength = expectedInputLength(entry);
  if (vector.length !== expectedLength) {
    throw new Error(`Badugi ONNX feature length ${vector.length} does not match ${expectedLength}`);
  }
  return new Float32Array(vector);
}

export function buildDrawOnnxFeatures(entry, payload = {}) {
  const vector = buildDrawObservationVector(payload.observation ?? payload);
  const expectedLength = expectedInputLength(entry) || DRAW_OBSERVATION_VECTOR_SIZE;
  if (vector.length !== expectedLength) {
    throw new Error(`Draw ONNX feature length ${vector.length} does not match ${expectedLength}`);
  }
  return new Float32Array(vector);
}

function buildBetFeatures(entry, payload) {
  const variantId = payload.variantId ?? payload.observation?.variantId;
  if (variantId === "D03") {
    return buildBadugiOnnxFeatures(entry, payload);
  }
  if (isDrawRlVariant(variantId)) {
    return buildDrawOnnxFeatures(entry, payload);
  }
  const length = expectedInputLength(entry) || 16;
  const maxStack = Math.max(1, payload.actor?.stack ?? 1);
  const buf = toFloat32Array(length, (idx) => {
    switch (idx) {
      case 0:
        return payload.toCall / maxStack;
      case 1:
        return (payload.betSize ?? 0) / maxStack;
      case 2:
        return (payload.potSize ?? 0) / (maxStack * 6);
      case 3:
        return payload.madeCards / 4;
      default:
        return 0;
    }
  });
  return buf;
}

function decodeBetOutput(result, payload) {
  if (!result?.data || result.data.length === 0) return null;
  const data = Array.from(result.data);
  let maxIdx = 0;
  let maxVal = data[0];
  for (let i = 1; i < data.length; i += 1) {
    if (data[i] > maxVal) {
      maxVal = data[i];
      maxIdx = i;
    }
  }
  const legalActions = getLegalActions(payload);
  const actions = legalActions.length
    ? legalActions
    : BADUGI_RL_ACTIONS.map((action) => action.toUpperCase());
  const action = actions[maxIdx % actions.length];
  let raiseSize = payload.betSize;
  if (action === "RAISE" && data.length > 4) {
    const scale = Math.max(0.5, Math.min(2, data[4] || 1));
    raiseSize = Math.round((payload.betSize ?? 1) * scale);
  }
  return {
    action,
    raiseSize,
    source: "onnx",
  };
}

function buildDrawFeatures(entry, payload) {
  const variantId = payload.variantId ?? payload.observation?.variantId;
  if (variantId === "D03") {
    return buildBadugiOnnxFeatures(entry, payload);
  }
  if (isDrawRlVariant(variantId)) {
    return buildDrawOnnxFeatures(entry, payload);
  }
  const length = expectedInputLength(entry) || 8;
  const buf = toFloat32Array(length, (idx) => {
    switch (idx) {
      case 0:
        return payload.madeCards / 4;
      case 1:
        return (payload.kicker ?? 13) / 13;
      default:
        return 0;
    }
  });
  return buf;
}

function decodeDrawOutput(result) {
  if (!result?.data || result.data.length === 0) return null;
  const data = Array.from(result.data);
  let maxIdx = 0;
  let maxVal = data[0];
  for (let i = 1; i < data.length; i += 1) {
    if (data[i] > maxVal) {
      maxVal = data[i];
      maxIdx = i;
    }
  }
  const drawCount = Math.max(0, Math.min(3, maxIdx));
  return { drawCount, source: "onnx" };
}

export async function inferBetActionWithOnnx(payload) {
  const entry = selectModelForVariant({
    variantId: payload.variantId,
    tierId: payload.tierId,
  });
  if (!entry) return null;
  const session = await getOrCreateSession(entry);
  if (!session) return null;
  const totalLength = expectedInputLength(entry);
  let tensorData;
  try {
    tensorData = buildBetFeatures(entry, payload);
  } catch (err) {
    console.warn("[ONNX] invalid bet feature shape", err);
    return null;
  }
  const inputName = session.inputNames[0];
  const ort = await getOrt();
  if (!ort) return null;
  const tensor = new ort.Tensor("float32", tensorData, entry.inputShape ?? [totalLength]);
  try {
    const outputs = await session.run({ [inputName]: tensor });
    const outputName = session.outputNames[0];
    return decodeBetOutput(outputs[outputName], payload);
  } catch (err) {
    console.warn("[ONNX] bet inference failed", err);
    return null;
  }
}

export async function inferDrawDecisionWithOnnx(payload) {
  const entry = selectModelForVariant({
    variantId: payload.variantId,
    tierId: payload.tierId,
  });
  if (!entry) return null;
  const session = await getOrCreateSession(entry);
  if (!session) return null;
  const totalLength = expectedInputLength(entry);
  let tensorData;
  try {
    tensorData = buildDrawFeatures(entry, payload);
  } catch (err) {
    console.warn("[ONNX] invalid draw feature shape", err);
    return null;
  }
  const inputName = session.inputNames[0];
  const ort = await getOrt();
  if (!ort) return null;
  const tensor = new ort.Tensor("float32", tensorData, entry.inputShape ?? [totalLength]);
  try {
    const outputs = await session.run({ [inputName]: tensor });
    const outputName = session.outputNames[0];
    return decodeDrawOutput(outputs[outputName]);
  } catch (err) {
    console.warn("[ONNX] draw inference failed", err);
    return null;
  }
}

export function getRlDecisionFallbackPriority() {
  return [...BADUGI_RL_FALLBACK_PRIORITY];
}

export function buildDeterministicSafeDecision(validActions = []) {
  const action = chooseDeterministicSafeAction(validActions);
  if (!action) return null;
  return {
    action: action.toUpperCase(),
    source: "deterministic-safe",
  };
}
