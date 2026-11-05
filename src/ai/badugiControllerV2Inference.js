import { getOrCreateSession, getOrt } from './onnxExecutor.js';
import { buildBadugiControllerEventObservationV2Draft } from '../rl/badugiControllerEventProjectionV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from '../rl/badugiControllerSeatEventViewV2Draft.js';

const BET_ACTIONS = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'];

function emitTrace(payload, entry, phase, status, reason, started) {
  try {
    payload.onInferenceTrace?.({
      variantId: 'D03', tierId: entry.tier, phase,
      requestedModelId: entry.id, selectedModelId: entry.id,
      usedModelId: status === 'used' ? entry.id : null,
      status, reason, elapsedMs: Math.max(0, Date.now() - started),
      schemaVersion: entry.featureSet,
    });
  } catch { /* A diagnostic sink must never change the action. */ }
}

function buildObservation(payload) {
  const events = (payload.v2Events ?? []).filter((event) =>
    event.type === 'BET_ACTION' || event.type === 'DRAW_ACTION');
  const seatEvents = buildBadugiControllerSeatEventViewV2Draft({
    publicEvents: events,
    actorDrawEvents: events.filter((event) => event.type === 'DRAW_ACTION' &&
      event.seat === payload.v2SeatIndex),
    seatIndex: payload.v2SeatIndex,
  });
  return buildBadugiControllerEventObservationV2Draft({
    controller: payload.v2Controller, state: payload.v2State,
    seatIndex: payload.v2SeatIndex, publicEvents: seatEvents,
    isTournament: payload.v2Tournament,
  });
}

export function createBadugiControllerV2Inference(entry) {
  if (!entry?.id || !entry?.onnx || entry.featureSet !== 'badugi-controller-observation-v2-draft' ||
      entry.inputShape?.[0] !== 96 || entry.outputShape?.[0] !== 6 ||
      !['beginner', 'standard', 'pro'].includes(entry.tier)) {
    throw new TypeError('D03 v2 inference requires a versioned 96-input/6-output tier entry');
  }
  async function infer(payload, phase) {
    const started = Date.now();
    try {
      const observation = buildObservation(payload);
      if (observation.length !== 96) throw new TypeError('v2 model requires 96 inputs');
      const mask = observation.slice(32, 38);
      let session = await getOrCreateSession(entry);
      // WebKit can reject one WASM session creation under concurrent load and
      // succeed on the next attempt. Retry once within the controller deadline;
      // a second failure still takes the existing legal fallback path.
      if (!session) session = await getOrCreateSession(entry);
      const runtime = await getOrt();
      if (!session || !runtime) throw new Error('v2 ONNX runtime unavailable');
      const input = new runtime.Tensor('float32', observation, [1, 96]);
      const output = await session.run({ [session.inputNames[0]]: input });
      const scores = output[session.outputNames[0]]?.data;
      if (!scores || scores.length !== 6) throw new TypeError('v2 model requires six scores');
      const liveLegalActions = new Set((payload.legalActions ?? [])
        .map((action) => String(action).toUpperCase()));
      let actionIndex = -1;
      let best = -Infinity;
      for (let index = 0; index < 6; index += 1) {
        if (mask[index] !== 1 || !Number.isFinite(scores[index])) continue;
        const actionName = phase === 'DRAW' ? `DRAW_${index}` : BET_ACTIONS[index];
        if (liveLegalActions.size > 0 && !liveLegalActions.has(actionName)) continue;
        if (scores[index] > best) { actionIndex = index; best = scores[index]; }
      }
      if (actionIndex < 0) throw new TypeError('v2 model has no legal score');
      const decision = phase === 'DRAW'
        ? { drawCount: actionIndex, source: 'onnx', modelId: entry.id, tierId: entry.tier }
        : { action: BET_ACTIONS[actionIndex], raiseSize: payload.betSize,
          source: 'onnx', modelId: entry.id, tierId: entry.tier };
      emitTrace(payload, entry, phase, 'used', null, started);
      return decision;
    } catch (error) {
      emitTrace(payload, entry, phase, 'failed', String(error?.message ?? error), started);
      return null;
    }
  }
  return {
    inferBet: (payload) => infer(payload, 'BET'),
    inferDraw: (payload) => infer(payload, 'DRAW'),
  };
}
