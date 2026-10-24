import { afterEach, describe, expect, it, vi } from 'vitest';
import * as adapter from '../../../ai/onnxPolicyAdapter.js';
import { buildCpuDecisionTelemetry } from '../../../ai/qa/cpuDecisionPersistence.js';
import { DeuceToSevenTripleDrawController } from '../DeuceToSevenTripleDrawController.js';

afterEach(() => vi.restoreAllMocks());

describe('draw controller inference evidence', () => {
  it.each(['BET', 'DRAW'].flatMap(phase => ['used', 'failed'].map(status => [phase, status])))(
    'preserves %s %s evidence through CPU action persistence', async (phase, status) => {
      const controller = new DeuceToSevenTripleDrawController({ numSeats: 6, startingStack: 500 });
      let state = controller.createNewHandState(controller.createInitialState(), { handId: 'trace-hand' });
      for (let n = 0; phase === 'DRAW' && state.snapshot.phase !== 'DRAW' && n < 30; n++) {
        const actor = state.snapshot.actingPlayerIndex;
        const legal = controller.getLegalActions(state, actor);
        state = controller.applyAction(state, { seatIndex: actor, type: legal.some(a => a.type === 'CHECK') ? 'CHECK' : 'CALL' }).state;
      }
      expect(state.snapshot.phase).toBe(phase);
      const seat = state.snapshot.actingPlayerIndex;
      const trace = { variantId: 'D01', tierId: 'standard', phase, status, requestedModelId: null, selectedModelId: 'draw-model', usedModelId: status === 'used' ? 'draw-model' : null, reason: status === 'used' ? null : 'session-unavailable', elapsedMs: 21 };
      vi.spyOn(adapter, phase === 'BET' ? 'inferBetActionWithOnnx' : 'inferDrawDecisionWithOnnx').mockImplementation(async payload => {
        payload.onInferenceTrace(trace);
        return status === 'failed' ? null : phase === 'BET' ? { action: 'CALL', modelId: 'draw-model' } : { drawCount: 1, modelId: 'draw-model' };
      });
      const action = await controller.getCpuActionAsync(state, seat, { tierConfig: { id: 'standard' } });
      expect(action).toBeTruthy();
      expect(action.metadata.inferenceTrace).toEqual(trace);
      expect(action.metadata.modelId).toBe(trace.usedModelId);
      expect(action.metadata.decisionSource).toBe(status === 'used' ? 'onnx' : 'fallback');
      if (status === 'failed') expect(action.metadata).toMatchObject({ decisionSource: 'fallback', fallbackReason: 'session-unavailable' });
      const stored = buildCpuDecisionTelemetry({ variantId: 'D01', phase, actorSeat: seat, seatSnapshot: state.snapshot.players[seat], actionType: action.type, metadata: action.metadata });
      expect(stored.cpuDecision.inferenceTrace).toEqual(trace);
    },
  );
});
