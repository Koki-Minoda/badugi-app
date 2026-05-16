# MGX Badugi Test Coverage Audit

Status: Step1 progression audit

Scope: Badugi game progression. Mobile layout is recorded only and remains out of scope for this step.

| Risk | Existing Test | Covered? | Gap | New Test Needed |
| --- | --- | --- | --- | --- |
| 6max pre-draw first actor | `src/games/badugi/BadugiGameController.test.js`; Step1 `badugiBettingOrderSpec.test.js` | Yes | None for controller path. | Keep in release gate. |
| 3way pre-draw first actor | Step1 `badugiBettingOrderSpec.test.js` | Yes | Previously not explicit enough. | Added. |
| HU pre-draw first actor | Step1 `badugiBettingOrderSpec.test.js` | Yes | Previously not explicit enough. | Added. |
| Post-draw first actor | Step1 `badugiBettingOrderSpec.test.js`; `badugiNoNextAliveRegression.test.js` | Yes | No browser-only post-draw actor assertion. | Keep E2E monitoring. |
| Folded/all-in actor skip | `badugiNoNextAliveRegression.test.js`; Step1 `badugiBettingOrderSpec.test.js` | Yes | None for controller path. | Keep in release gate. |
| Full 3-draw progression | `tests/e2e/badugi-flow.spec.ts`; `tests/e2e/badugi-full-round-pot-regression.spec.ts`; Step1 `badugiProgressionSpec.test.js`; Step1 `badugi-progression-spec.spec.ts` | Yes | Long-run multi-hand path still blocked. | Keep long-run expected-fail until fixed. |
| Check-around progression | `badugiNoNextAliveRegression.test.js`; Step1 `badugiProgressionSpec.test.js` | Yes | None for focused controller path. | Keep in release gate. |
| Bet/call progression | `BadugiGameController.test.js`; Step1 `badugiProgressionSpec.test.js` | Yes | Browser path covered indirectly. | Keep in E2E. |
| Raise/cap progression | `src/games/badugi/controller/__tests__/BadugiGameController.test.js`; `src/games/badugi/logic/__tests__/bettingRules.test.js` | Yes | No new gap in this audit. | None. |
| Fold to single winner | Step1 `badugiShowdownNextHandSpec.test.js` | Yes | Was not release-gate explicit. | Added. |
| All-in progression | Existing `badugiNoNextAliveRegression.test.js` and engine tests cover actor skip; Step1 betting skip adds focused coverage. | Partial | Full all-in-through-draw browser path is not dedicated. | Add later if Badugi moves toward alpha_playable. |
| No-next-alive | `src/games/badugi/__tests__/badugiNoNextAliveRegression.test.js` | Yes | None. | Keep in release gate. |
| Pot continuity through street transitions | `src/ui/__tests__/badugiPotSnapshotMerge.test.jsx`; `tests/e2e/badugi-full-round-pot-regression.spec.ts`; Step1 `badugiPotContinuitySpec.test.js` | Partial | Long-run browser can still surface active-hand `Total Pot 0`. | Keep P1 blocker. |
| Side pot | `src/games/badugi/engine/__tests__/potAccounting.test.js`; broader EV tests | Partial | Strict active-hand side-pot UI path not release-gate explicit. | Add after core progression blocker is closed. |
| Showdown | `BadugiGameController.test.js`; evaluator tests; focused E2E | Yes | Long-run terminal transition still blocked. | Keep P1 blocker. |
| Next hand | Focused E2E and Step1 `badugiShowdownNextHandSpec.test.js` | Partial | Long-run five-hand restore smoke is expected-fail. | Fix before release. |
| UI snapshot merge | `src/ui/__tests__/badugiPotSnapshotMerge.test.jsx`; `src/ui/__tests__/badugiTurnSnapshotMerge.test.jsx`; Step1 `badugiSnapshotMergeSpec.test.jsx` | Yes | None for canonical actor/pot merge. | Added aggregate release spec. |
| Stale `actingPlayerIndex` | `src/ui/__tests__/badugiTurnSnapshotMerge.test.jsx`; Step1 `badugiSnapshotMergeSpec.test.jsx` | Yes | None. | Keep in release gate. |
| Hero action bar consistency | Step1 `badugiSnapshotMergeSpec.test.jsx` | Partial | Component-level action bar assertion is covered through adapter state, not full rendered action bar in every street. | Keep E2E monitoring. |
| Browser E2E | `badugi-flow`, `badugi-full-round-pot-regression`, `badugi-alpha-long-run-smoke`, Step1 `badugi-progression-spec` | Partial | Long-run remains expected-fail and blocks release readiness. | Fix in later step. |
| Mobile progression | `badugi-mobile-gameplay-layout.spec.ts` | Out of Step1 scope | Portrait mobile remains a separate blocker. | Step5 / mobile hardening. |

## Coverage Conclusion

The immediate unit and focused E2E coverage is now strong enough to detect Badugi betting-order, draw-count, pot-continuity, showdown, next-hand, and stale-turn regressions. Badugi is still not release-ready because the long-run browser restore gate remains expected-fail and can expose active-hand pot / terminal-transition mismatches.
