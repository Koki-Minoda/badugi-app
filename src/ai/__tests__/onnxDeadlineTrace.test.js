import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTracedOnnxInferenceWithDeadline } from '../onnxInferenceDeadline.js';

const payload = { variantId: 'D03', tierId: 'standard', phase: 'BET' };
const used = { ...payload, status: 'used', selectedModelId: 'model-a', usedModelId: 'model-a', elapsedMs: 2 };
afterEach(() => vi.useRealTimers());
describe('request-scoped deadline evidence', () => {
  it('preserves the adapter evidence and action', async () => {
    const result = await runTracedOnnxInferenceWithDeadline(async ({onInferenceTrace}) => {
      onInferenceTrace(used); return { action: 'CALL' };
    }, payload);
    expect(result).toMatchObject({ decision: {action:'CALL'}, timedOut:false, inferenceTrace:used });
  });
  it('keeps a timeout final even when the model later succeeds', async () => {
    vi.useFakeTimers();
    let finish;
    const pending = runTracedOnnxInferenceWithDeadline(({onInferenceTrace}) => new Promise(resolve => {
      finish = () => { onInferenceTrace(used); resolve({action:'RAISE'}); };
    }), payload, {timeoutMs:10});
    await vi.advanceTimersByTimeAsync(10);
    const result = await pending;
    expect(result).toMatchObject({decision:null,timedOut:true,inferenceTrace:{status:'fallback',reason:'inference-timeout',usedModelId:null,elapsedMs:10}});
    finish(); await Promise.resolve(); await Promise.resolve();
    expect(result.inferenceTrace.status).toBe('fallback');
    expect(result.inferenceTrace.usedModelId).toBeNull();
  });
  it('does not attribute a parallel request failure to a successful model', async () => {
    const [success, failure] = await Promise.all([
      runTracedOnnxInferenceWithDeadline(async ({onInferenceTrace}) => {onInferenceTrace(used); return {action:'CALL'};}, payload),
      runTracedOnnxInferenceWithDeadline(async () => {throw new Error('private runtime detail');}, {...payload,phase:'DRAW'}),
    ]);
    expect(success.inferenceTrace.usedModelId).toBe('model-a');
    expect(failure.inferenceTrace).toMatchObject({phase:'DRAW',status:'failed',reason:'inference-failed',usedModelId:null});
    expect(JSON.stringify(failure.inferenceTrace)).not.toContain('private runtime detail');
  });
  it('retains the adapter reason when inference returns no decision', async () => {
    const trace = {...used,status:'failed',reason:'session-unavailable',usedModelId:null};
    const result = await runTracedOnnxInferenceWithDeadline(async ({onInferenceTrace}) => {onInferenceTrace(trace);return null;}, payload);
    expect(result.inferenceTrace).toEqual(trace);
  });
});
