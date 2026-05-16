const DEFAULT_LIMIT = 5000;

function now() {
  return Date.now();
}

function getWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function getBrowserGameplayTrace() {
  const win = getWindow();
  if (!win) return [];
  if (!Array.isArray(win.__MGX_GAMEPLAY_TRACE__)) {
    win.__MGX_GAMEPLAY_TRACE__ = [];
  }
  return win.__MGX_GAMEPLAY_TRACE__;
}

export function clearBrowserGameplayTrace() {
  const win = getWindow();
  if (!win) return [];
  win.__MGX_GAMEPLAY_TRACE__ = [];
  return win.__MGX_GAMEPLAY_TRACE__;
}

export function recordBrowserGameplayTrace(entry, { limit = DEFAULT_LIMIT } = {}) {
  const trace = getBrowserGameplayTrace();
  const row = {
    timestamp: now(),
    ...(entry ?? {}),
  };
  trace.push(row);
  if (trace.length > limit) {
    trace.splice(0, trace.length - limit);
  }
  return row;
}

export function installBrowserGameplayTraceGlobals() {
  const win = getWindow();
  if (!win) return null;
  if (!Array.isArray(win.__MGX_GAMEPLAY_TRACE__)) {
    win.__MGX_GAMEPLAY_TRACE__ = [];
  }
  win.__MGX_CLEAR_GAMEPLAY_TRACE__ = clearBrowserGameplayTrace;
  return {
    trace: win.__MGX_GAMEPLAY_TRACE__,
    clear: win.__MGX_CLEAR_GAMEPLAY_TRACE__,
  };
}

