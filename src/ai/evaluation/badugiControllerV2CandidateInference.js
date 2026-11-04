// Evaluation-only D03 v2 adapter. No registry entry or shipped model URL.
import { getOrCreateSession, getOrt } from '../onnxExecutor.js';
import { buildBadugiControllerEventObservationV2Draft } from '../../rl/badugiControllerEventProjectionV2Draft.js';
import { buildBadugiControllerSeatEventViewV2Draft } from '../../rl/badugiControllerSeatEventViewV2Draft.js';

const MODEL_ID = 'isolated-d03-v2-beginner-candidate';
const ENTRY = { id: MODEL_ID, onnx: '/__d03_v2_candidate.onnx' };
const BET_ACTIONS = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'];

function report(payload, phase, status, reason, started) {
  payload.onInferenceTrace?.({
    variantId: 'D03', tierId: 'beginner', phase,
    requestedModelId: MODEL_ID, selectedModelId: MODEL_ID,
    usedModelId: status === 'used' ? MODEL_ID : null,
    status, reason, elapsedMs: Math.max(0, Date.now() - started),
    schemaVersion: 'badugi-controller-observation-v2-draft',
  });
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

async function infer(payload, phase) {
  const started = Date.now();
  try {
    const observation = buildObservation(payload);
    if (observation.length !== 96) throw new TypeError('v2 candidate requires 96 inputs');
    const mask = observation.slice(32, 38);
    const session = await getOrCreateSession(ENTRY);
    const runtime = await getOrt();
    if (!session || !runtime) throw new Error('candidate ONNX runtime unavailable');
    const input = new runtime.Tensor('float32', observation, [1, 96]);
    const output = await session.run({ [session.inputNames[0]]: input });
    const scores = output[session.outputNames[0]]?.data;
    if (!scores || scores.length !== 6) throw new TypeError('v2 candidate requires six scores');
    let actionIndex = -1;
    let best = -Infinity;
    for (let index = 0; index < 6; index += 1) {
      if (mask[index] !== 1 || !Number.isFinite(scores[index])) continue;
      if (scores[index] > best) { actionIndex = index; best = scores[index]; }
    }
    if (actionIndex < 0) throw new TypeError('v2 candidate has no legal score');
    const decision = phase === 'DRAW'
      ? { drawCount: actionIndex, source: 'onnx', modelId: MODEL_ID, tierId: 'beginner' }
      : { action: BET_ACTIONS[actionIndex], raiseSize: payload.betSize,
        source: 'onnx', modelId: MODEL_ID, tierId: 'beginner' };
    report(payload, phase, 'used', null, started);
    return decision;
  } catch (error) {
    report(payload, phase, 'failed', String(error?.message ?? error), started);
    return null;
  }
}

export const inferBadugiControllerV2CandidateBet = (payload) => infer(payload, 'BET');
export const inferBadugiControllerV2CandidateDraw = (payload) => infer(payload, 'DRAW');
