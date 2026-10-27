import { expect, test } from '@playwright/test';
import { APP_URL } from './authHelper';

test('WebKit loads the CPU-only WASM runtime and performs real ONNX inference', async ({ page }) => {
  const pageErrors: string[] = [];
  const wasmRequests: string[] = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('request', request => {
    if (request.url().includes('ort-wasm')) wasmRequests.push(request.url());
  });

  await page.goto(`${new URL(APP_URL).origin}/dev/`);
  const inference = await page.evaluate(async () => {
    const { getOrt, getOrCreateSession } = await import('/dev/src/ai/onnxExecutor.js');
    const session = await getOrCreateSession({
      id: 'webkit-cpu-wasm-smoke',
      onnx: 'models/badugi_sixmax_standard_e11.onnx',
    });
    if (!session) return null;
    const ort = await getOrt();
    const input = new ort.Tensor('float32', new Float32Array(96), [96]);
    const outputs = await session.run({ [session.inputNames[0]]: input });
    return {
      outputNames: Object.keys(outputs),
      outputLength: outputs[session.outputNames[0]]?.data?.length,
    };
  });

  expect(inference?.outputNames.length).toBeGreaterThan(0);
  expect(inference?.outputLength).toBe(6);
  expect(wasmRequests.some(url => url.includes('ort-wasm-simd-threaded.wasm'))).toBe(true);
  expect(wasmRequests.some(url => url.includes('.jsep.wasm'))).toBe(false);
  expect(pageErrors).toEqual([]);
});
