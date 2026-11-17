import { useLayoutEffect, useRef, useState } from "react";

const preferenceKey = "mgx.handResult.autoNext";

function readAutoNext() {
  try { return localStorage.getItem(preferenceKey) !== "off"; }
  catch { return true; }
}

export function useHandResultAutoNext({ onNext, onAutoNext, blocked }) {
  const [enabled, setEnabled] = useState(readAutoNext);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);
  const issued = useRef(false);
  const latest = useRef(onAutoNext);
  const available = typeof onAutoNext === "function";

  const stop = () => clearTimeout(timer.current);
  const pause = () => {
    stop();
    setPaused(true);
  };
  const toggle = () => {
    stop();
    const next = !enabled || paused;
    setEnabled(next);
    setPaused(false);
    try { localStorage.setItem(preferenceKey, next ? "on" : "off"); }
    catch { /* The current hand can still be paused. */ }
  };
  const advance = (callback) => {
    if (issued.current || typeof callback !== "function") return;
    issued.current = true;
    stop();
    if (callback() === false) {
      issued.current = false;
      setPaused(true);
    }
  };

  useLayoutEffect(() => { latest.current = onAutoNext; }, [onAutoNext]);
  useLayoutEffect(() => {
    if (!available || blocked || !enabled || paused) return;
    const stopTimer = () => clearTimeout(timer.current);
    const arm = () => {
      stopTimer();
      if (!document.hidden && !issued.current) {
        timer.current = setTimeout(() => {
          if (document.hidden || issued.current) return;
          issued.current = true;
          if (latest.current?.() === false) {
            issued.current = false;
            setPaused(true);
          }
        }, 2000);
      }
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", arm);
    };
  }, [available, blocked, enabled, paused]);

  return { available, running: available && enabled && !blocked && !paused, toggle, pause, next: () => advance(onNext) };
}
