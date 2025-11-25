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
    forceSeatAction: (...args) => apiRef.current?.forceSeatAction?.(...args),
    forceSequentialFolds: (...args) => apiRef.current?.forceSequentialFolds?.(...args),
    forceAllIn: (...args) => apiRef.current?.forceAllIn?.(...args),
    resolveHandNow: (...args) => apiRef.current?.resolveHandNow?.(...args),
    dealNewHandNow: (...args) => apiRef.current?.dealNewHandNow?.(...args),
    getStateSnapshot: (...args) => apiRef.current?.getStateSnapshot?.(...args),
    setPlayerHands: (...args) => apiRef.current?.setPlayerHands?.(...args),
    getLastPotSummary: (...args) => apiRef.current?.getLastPotSummary?.(...args),
    getHandHistory: (...args) => apiRef.current?.getHandHistory?.(...args),
    getTournamentHudState: (...args) => apiRef.current?.getTournamentHudState?.(...args),
    getTournamentPlacements: (...args) => apiRef.current?.getTournamentPlacements?.(...args),
    isTournamentOverlayVisible: (...args) =>
      apiRef.current?.isTournamentOverlayVisible?.(...args),
    startTournamentMTT: (...args) => apiRef.current?.startTournamentMTT?.(...args),
    simulateTournamentBackground: (...args) =>
      apiRef.current?.simulateTournamentBackground?.(...args),
    completeHeroHands: (...args) => apiRef.current?.completeHeroHands?.(...args),
    forceHeroBust: (...args) => apiRef.current?.forceHeroBust?.(...args),
    fastForwardMTTComplete: (...args) =>
      apiRef.current?.fastForwardMTTComplete?.(...args),
    getTournamentReplay: (...args) => apiRef.current?.getTournamentReplay?.(...args),
  };

  const target =
    window.__BADUGI_E2E__ && typeof window.__BADUGI_E2E__ === "object"
      ? window.__BADUGI_E2E__
      : {};
  Object.assign(target, driver);
  window.__BADUGI_E2E__ = target;

  return () => {
    if (typeof window === "undefined" || window.__BADUGI_E2E__ !== target) {
      return;
    }
    Object.keys(driver).forEach((key) => {
      if (window.__BADUGI_E2E__[key] === driver[key]) {
        delete window.__BADUGI_E2E__[key];
      }
    });
  };
}
