let ortPromise = null;
const sessionCache = new Map();

export async function getOrt() {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web")
      .then((mod) => mod.default ?? mod)
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
