import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('onnxruntime-web/wasm', () => ({ default: { env: { wasm: {} }, InferenceSession: { create } } }));
let getOrCreateSession;
beforeEach(async () => {
  vi.resetModules();
  create.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })));
  ({ getOrCreateSession } = await import('../onnxExecutor.js'));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('shares initialization while simultaneous decisions request the same model', async () => {
  let resolve;
  create.mockImplementation(() => new Promise(done => { resolve = done; }));
  const entry = { id: 'standard', onnx: '/models/standard.onnx' };
  const first = getOrCreateSession(entry);
  const second = getOrCreateSession(entry);
  await vi.waitFor(() => expect(create).toHaveBeenCalled());
  expect(create).toHaveBeenCalledTimes(1);
  const session = { run: vi.fn() };
  resolve(session);
  expect(await Promise.all([first, second])).toEqual([session, session]);
  expect(await getOrCreateSession(entry)).toBe(session);
  expect(create).toHaveBeenCalledTimes(1);
});
it('retries a failed initialization instead of caching failure permanently', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const entry = { id: 'standard', onnx: '/models/standard.onnx' };
  const session = { run: vi.fn() };
  create.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce(session);
  expect(await getOrCreateSession(entry)).toBeNull();
  expect(await getOrCreateSession(entry)).toBe(session);
  expect(create).toHaveBeenCalledTimes(2);
});
