import ortWasmJsepUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url";

let ortPromise = null;
const sessionCache = new Map();

export async function getOrt() {
  if (!ortPromise) {
    ortPromise = Promise.all([
      import("onnxruntime-web"),
      fetch(ortWasmJsepUrl).then(async (response) => {
        if (!response.ok) {
          throw new Error(`ONNX WASM request failed (${response.status})`);
        }
        return new Uint8Array(await response.arrayBuffer());
      }),
    ])
      .then(([mod, wasmBinary]) => {
        const ort = mod.default ?? mod;
        // onnxruntime-web derives its WASM location from its transformed module
        // URL. Vite's development base and production asset base differ, so the
        // derived URL can resolve to the SPA HTML fallback. Supplying the binary
        // directly also prevents compileStreaming from failing when an existing
        // production proxy serves .wasm as application/octet-stream.
        ort.env.wasm.wasmPaths = { wasm: ortWasmJsepUrl };
        ort.env.wasm.wasmBinary = wasmBinary;
        return ort;
      })
      .catch((err) => {
        console.warn("[ONNX] Failed to load onnxruntime-web", err);
        return null;
      });
  }
  return ortPromise;
}

export async function getOrCreateSession(entry) {
  if (!entry?.onnx) return null;
  if (sessionCache.has(entry.id)) {
    return sessionCache.get(entry.id);
  }
  const ort = await getOrt();
  if (!ort) return null;
  try {
    const session = await ort.InferenceSession.create(entry.onnx);
    sessionCache.set(entry.id, session);
    return session;
  } catch (err) {
    console.warn("[ONNX] Failed to create session", entry.onnx, err);
    return null;
  }
}

export function clearOnnxSessions() {
  sessionCache.clear();
}
