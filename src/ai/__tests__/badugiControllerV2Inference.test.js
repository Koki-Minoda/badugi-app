import { describe, expect, it, vi } from 'vitest';

const run = vi.fn();
vi.mock('../onnxExecutor.js', () => ({
  getOrt: vi.fn(async () => ({ Tensor: class Tensor {} })),
  getOrCreateSession: vi.fn(async () => ({
    inputNames: ['input'], outputNames: ['output'], run,
  })),
}));
vi.mock('../../rl/badugiControllerSeatEventViewV2Draft.js', () => ({
  buildBadugiControllerSeatEventViewV2Draft: vi.fn(() => []),
}));
vi.mock('../../rl/badugiControllerEventProjectionV2Draft.js', () => ({
  buildBadugiControllerEventObservationV2Draft: vi.fn(() => {
    const vector = new Float32Array(96);
    vector.fill(1, 32, 38);
    return vector;
  }),
}));

const { createBadugiControllerV2Inference } = await import('../badugiControllerV2Inference.js');
const adapter = createBadugiControllerV2Inference({
  id: 'beginner-v2-test', onnx: 'test.onnx', tier: 'beginner',
  featureSet: 'badugi-controller-observation-v2-draft',
  inputShape: [96], outputShape: [6],
});
const standardAdapter = createBadugiControllerV2Inference({
  id: 'standard-v2-test', onnx: 'standard-test.onnx', tier: 'standard',
  featureSet: 'badugi-controller-observation-v2-draft',
  inputShape: [96], outputShape: [6],
});
const proAdapter = createBadugiControllerV2Inference({
  id: 'isolated-pro-v2-test', onnx: 'pro-test.onnx', tier: 'pro',
  featureSet: 'badugi-controller-observation-v2-draft',
  inputShape: [96], outputShape: [6],
});

describe('Badugi controller-v2 live legality', () => {
  it('does not select a raise rejected by the current UI action gate', async () => {
    run.mockResolvedValueOnce({ output: { data: [0, 1, 2, 3, 100, 0] } });
    const traces = [];
    const decision = await adapter.inferBet({ legalActions: ['FOLD', 'CALL'],
      onInferenceTrace: (row) => traces.push(row) });
    expect(decision).toMatchObject({ action: 'CALL', modelId: 'beginner-v2-test' });
    expect(traces[0]).toMatchObject({ status: 'used', usedModelId: 'beginner-v2-test' });
  });

  it('does not select a draw count outside the live legal list', async () => {
    run.mockResolvedValueOnce({ output: { data: [0, 4, 3, 2, 1, 100] } });
    const decision = await adapter.inferDraw({ legalActions: ['draw_0', 'draw_1'] });
    expect(decision).toMatchObject({ drawCount: 1, modelId: 'beginner-v2-test' });
  });

  it('keeps the Standard tier and current legal mask in its decision trace', async () => {
    run.mockResolvedValueOnce({ output: { data: [100, 0, 3, 0, 0, 0] } });
    const traces = [];
    const decision = await standardAdapter.inferBet({ legalActions: ['CALL'],
      onInferenceTrace: (row) => traces.push(row) });
    expect(decision).toMatchObject({ action: 'CALL', tierId: 'standard', modelId: 'standard-v2-test' });
    expect(traces[0]).toMatchObject({ status: 'used', tierId: 'standard', usedModelId: 'standard-v2-test' });
  });

  it('accepts the isolated Pro tier while preserving the live legal mask', async () => {
    run.mockResolvedValueOnce({ output: { data: [100, 0, 3, 0, 0, 0] } });
    const traces = [];
    const decision = await proAdapter.inferBet({ legalActions: ['CALL'],
      onInferenceTrace: (row) => traces.push(row) });
    expect(decision).toMatchObject({ action: 'CALL', tierId: 'pro', modelId: 'isolated-pro-v2-test' });
    expect(traces[0]).toMatchObject({ status: 'used', tierId: 'pro', usedModelId: 'isolated-pro-v2-test' });
  });
});
