import ortWasmJsepUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url";

let ortPromise = null;
const sessionCache = new Map();

export async function getOrt() {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web")
      .then((mod) => {
        const ort = mod.default ?? mod;
        // onnxruntime-web derives its WASM location from its transformed module
        // URL. Vite's development base and production asset base differ, so the
        // derived URL can resolve to the SPA HTML fallback. Importing the binary
        // as a Vite asset gives both environments one authoritative URL.
        ort.env.wasm.wasmPaths = { wasm: ortWasmJsepUrl };
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
