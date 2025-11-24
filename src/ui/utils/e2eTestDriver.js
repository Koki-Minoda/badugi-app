/**
 * Installs a thin proxy object on window.__BADUGI_E2E__ so Playwright tests
 * can deterministically steer the Badugi engine. The actual implementations
 * live inside App.jsx; this module simply forwards calls to the latest helpers
 * exposed through the supplied ref.
 *
 * @param {React.MutableRefObject<object>} apiRef - holds the latest helper callbacks
 * @returns {() => void} cleanup function that removes the global helper
 */
export function installE2eTestDriver(apiRef) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const driver = {
    /**
     * Queue or immediately execute a specific action for the given seat.
     * actionPayload: { type: 'fold' | 'call' | 'raise' | 'check' | 'all-in', amount?: number }
     */
    forceSeatAction: (...args) => apiRef.current?.forceSeatAction?.(...args),
    /**
     * Convenience helper to fold several seats (in order) without clicking UI controls.
     */
    forceSequentialFolds: (...args) => apiRef.current?.forceSequentialFolds?.(...args),
    /**
     * Force a seat to push chips into the pot. When amount is omitted the entire stack is used.
     */
    forceAllIn: (...args) => apiRef.current?.forceAllIn?.(...args),
    /**
     * Skip the remaining streets and jump to showdown immediately.
     */
    resolveHandNow: (...args) => apiRef.current?.resolveHandNow?.(...args),
    /**
     * Start dealing the next hand right away (bypasses overlay buttons / timers).
     */
    dealNewHandNow: (...args) => apiRef.current?.dealNewHandNow?.(...args),
  };

  window.__BADUGI_E2E__ = driver;

  return () => {
    if (window.__BADUGI_E2E__ === driver) {
      delete window.__BADUGI_E2E__;
    }
  };
}
