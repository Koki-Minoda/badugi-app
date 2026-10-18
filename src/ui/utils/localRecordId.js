let sequence = 0;

// Local record identity only. Never use this fallback for authentication or room secrets.
export function localRecordId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  sequence += 1;
  return `local-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
