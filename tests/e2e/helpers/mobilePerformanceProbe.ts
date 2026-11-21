// Installed before the app. Keep only bounded timing samples, never payloads.
export function installMobilePerformanceProbe() {
  const samples: any[] = [];
  const append = (row: any) => {
    samples.push(row);
    if (samples.length > 10000) samples.splice(0, 1000);
  };
  const counters = { logs: 0, warnings: 0, errors: 0 };
  for (const level of ["log", "warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: any[]) => {
      counters[
        level === "log" ? "logs" : level === "warn" ? "warnings" : "errors"
      ]++;
      original(...args);
    };
  }
  const originalWrite = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    const start = performance.now();
    try {
      return originalWrite.call(this, key, value);
    } finally {
      append({
        kind: "storage-write",
        key,
        bytes: String(value).length * 2,
        ms: performance.now() - start,
      });
    }
  };
  let lastFrame: number | null = null;
  const frame = (now: number) => {
    if (lastFrame !== null) append({ kind: "frame-gap", ms: now - lastFrame });
    lastFrame = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  let expected = performance.now() + 100;
  setInterval(() => {
    const now = performance.now();
    append({ kind: "event-loop", ms: Math.max(0, now - expected) });
    expected = now + 100;
  }, 100);
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        append({ kind: "long-task", ms: entry.duration });
    }).observe({ entryTypes: ["longtask"] });
  } catch {}
  let pending: any = null;
  let previous: any = null;
  let scheduled = false;
  const sample = () => {
    scheduled = false;
    const panel = document.querySelector('[data-testid="decision-panel"]');
    const api = (window as any).__BADUGI_E2E__;
    if (!panel || !api?.getPhaseState) {
      previous = null;
      pending = null;
      return;
    }
    const state = api.getPhaseState();
    const now = performance.now();
    const turnKey = JSON.stringify([
      state.handId,
      state.phase,
      state.turn,
      state.drawRound,
      state.betRound,
    ]);
    const fingerprint = JSON.stringify([
      turnKey,
      state.players.map((p: any) => [
        p.stack,
        p.betThisRound,
        p.folded,
        p.hasDrawn,
        p.lastAction,
      ]),
    ]);
    if (previous?.turnKey !== turnKey) {
      if (
        previous &&
        typeof previous.turn === "number" &&
        previous.turn !== 0 &&
        ["BET", "DRAW"].includes(previous.phase)
      )
        append({
          kind: "cpu-turn",
          ms: now - previous.at,
          phase: previous.phase,
          actor: previous.turn,
        });
      previous = { turnKey, at: now, turn: state.turn, phase: state.phase };
    }
    if (pending && fingerprint !== pending.before) {
      append({
        kind: "hero-response",
        action: pending.action,
        ms: now - pending.at,
      });
      pending = null;
    }
    if (pending && now - pending.at > 10000) {
      append({
        kind: "hero-response-timeout",
        action: pending.action,
        ms: now - pending.at,
      });
      pending = null;
    }
  };
  const queue = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(sample);
    }
  };
  document.addEventListener(
    "click",
    (event) => {
      const element = (event.target as Element)?.closest("[data-testid]");
      const id = element?.getAttribute("data-testid") ?? "";
      if (!/^action-(check|call|raise|fold|draw-selected)$/.test(id)) return;
      const state = (window as any).__BADUGI_E2E__?.getPhaseState?.();
      if (!state) return;
      const turnKey = JSON.stringify([
        state.handId,
        state.phase,
        state.turn,
        state.drawRound,
        state.betRound,
      ]);
      pending = {
        action: id,
        at: performance.now(),
        before: JSON.stringify([
          turnKey,
          state.players.map((p: any) => [
            p.stack,
            p.betThisRound,
            p.folded,
            p.hasDrawn,
            p.lastAction,
          ]),
        ]),
      };
      queue();
    },
    true,
  );
  new MutationObserver(queue).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["disabled", "data-hand-id", "aria-pressed"],
  });
  (window as any).__MGX_PERF__ = {
    read: () => ({
      probeVersion: 2,
      samples: samples.splice(0),
      console: { ...counters },
      heapBytes: (performance as any).memory?.usedJSHeapSize ?? null,
      cpuTraceEntries: (window as any).__MGX_CPU_DECISION_TRACE__?.length ?? 0,
    }),
  };
}
