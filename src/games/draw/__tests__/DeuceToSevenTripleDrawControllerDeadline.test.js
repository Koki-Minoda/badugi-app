import { afterEach, expect, it, vi } from 'vitest';
import * as adapter from '../../../ai/onnxPolicyAdapter.js';
import { DeuceToSevenTripleDrawController } from '../DeuceToSevenTripleDrawController.js';

function fixture(phase) {
  const controller = new DeuceToSevenTripleDrawController({ numSeats: 6, startingStack: 500 });
  let state = controller.createNewHandState(controller.createInitialState(), { handId: 'deadline-hand' });
  for (let n = 0; phase === 'DRAW' && state.snapshot.phase !== 'DRAW' && n < 30; n++) {
    const actor = state.snapshot.actingPlayerIndex;
    const legal = controller.getLegalActions(state, actor);
    state = controller.applyAction(state, { seatIndex: actor, type: legal.some(a => a.type === 'CHECK') ? 'CHECK' : 'CALL' }).state;
  }
  expect(state.snapshot.phase).toBe(phase);
  return { controller, state, seat: state.snapshot.actingPlayerIndex };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it.each(['BET', 'DRAW'])('%s returns a fallback at the deadline and ignores late evidence', async phase => {
  vi.useFakeTimers();
  const { controller, state, seat } = fixture(phase);
  let payload, finish;
  vi.spyOn(adapter, phase === 'BET' ? 'inferBetActionWithOnnx' : 'inferDrawDecisionWithOnnx')
    .mockImplementation(input => { payload = input; return new Promise(resolve => { finish = resolve; }); });
  let completed = false;
  const pending = controller.getCpuActionAsync(state, seat).then(action => { completed = true; return action; });
  await vi.advanceTimersByTimeAsync(8000);
  try {
    expect(completed, 'CPU must stop waiting for an unresponsive model').toBe(true);
    const action = await pending;
    expect(action).toBeTruthy();
    expect(action.metadata.inferenceTrace).toMatchObject({ variantId: 'D01', phase, status: 'fallback', reason: 'inference-timeout', usedModelId: null });
    if (phase === 'BET') expect(controller.getLegalActions(state, seat).map(a => a.type)).toContain(action.type);
    else expect(action.type).toBe('DRAW');
    const finalized = JSON.stringify(action.metadata);
    payload.onInferenceTrace({ status: 'used', usedModelId: 'late-model', phase });
    finish(phase === 'BET' ? { action: 'CALL' } : { drawCount: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(action.metadata)).toBe(finalized);
  } finally { finish(null); await pending; }
});

it.each(['BET', 'DRAW'])('%s records an exception and returns a legal fallback', async phase => {
  const { controller, state, seat } = fixture(phase);
  vi.spyOn(adapter, phase === 'BET' ? 'inferBetActionWithOnnx' : 'inferDrawDecisionWithOnnx').mockRejectedValue(new Error('injected inference failure'));
  const action = await controller.getCpuActionAsync(state, seat);
  expect(action).toBeTruthy();
  expect(action.metadata.inferenceTrace).toMatchObject({ variantId: 'D01', phase, status: 'failed', reason: 'inference-failed', usedModelId: null });
});
