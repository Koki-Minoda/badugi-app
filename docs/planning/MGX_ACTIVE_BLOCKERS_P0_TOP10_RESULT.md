# MGX Active Blockers P0 Top 10 Result

Date: 2026-05-21

Scope:
- Requested work: handle roughly the first 1-10 P0/P0-P1 active blockers.
- Source: `docs/bugs/ACTIVE_BLOCKERS.md` and `docs/planning/MGX_ACTIVE_BLOCKERS_EXECUTION_PLAN.md`.
- Product code changes: none.
- Blocker state changes: none.
- Closed blockers: none, because all 10 rows still require physical-device evidence before closure.

## Target IDs

| Order | ID | Result |
|---:|---|---|
| 1 | `BADUGI-CASH-OPENING-ACTOR-001` | automated/emulation verified, physical QA pending |
| 2 | `BADUGI-BET-DRAW-TRANSITION-001` | automated/emulation verified, physical QA pending |
| 3 | `BADUGI-DRAW-BET-MIX-001` | automated/emulation verified, physical QA pending |
| 4 | `BADUGI-DRAW1-CPU-ACTION-001` | automated/emulation verified, physical QA pending |
| 5 | `BADUGI-FOLD-DRAW-FREEZE-001` | automated/emulation verified, physical QA pending |
| 6 | `PHYSICAL-MOBILE-BADUGI-WAITING-001` | automated/emulation verified, physical QA pending |
| 7 | `CROSS-VARIANT-STATE-001` | automated/emulation verified, physical QA pending |
| 8 | `BADUGI-HAND-SHAPE-001` | automated/emulation verified, physical QA pending |
| 9 | `TOUR-SEAT-LIFECYCLE-001` | automated/emulation verified, physical QA pending |
| 10 | `UI-MOBILE-TOURNAMENT-LANDSCAPE-001` | automated/emulation verified, physical QA pending |

## Implementation Summary

No product/runtime implementation was required by the automated repro pass.

One historical guard correction was made in `tests/e2e/core5-action-order-audit.spec.ts`:
- The audit now reconciles observed auto-advanced CPU seats before validating the next actor.
- The reconciliation only marks an intermediate seat as acted when the current snapshot proves that seat is folded, all-in, seat-out/busted, or has matched the current bet.
- This preserves actor-order detection while avoiding a false failure when the browser observes state after CPU auto-progress has already advanced through an intermediate seat.

## Test Evidence

Focused Vitest:
- Command: `npx vitest run src/games/badugi/__tests__/badugiCashOpeningActorRegression.test.js src/ui/__tests__/badugiCashOpeningActorSnapshotRegression.test.jsx src/games/badugi/__tests__/badugiBetToDrawTransitionRegression.test.js src/ui/__tests__/drawBetMixedStateRegression.test.jsx src/games/badugi/__tests__/badugiTournamentCpuDrawActionRegression.test.js src/ui/__tests__/badugiTournamentCpuDrawSnapshotRegression.test.jsx src/games/badugi/__tests__/badugiFoldedDrawActorRegression.test.js src/ui/__tests__/badugiFoldedDrawWaitingRegression.test.jsx src/games/badugi/__tests__/badugiHandShapeInvariant.test.js src/ui/__tests__/badugiHandShapeSnapshotRegression.test.jsx src/ui/__tests__/crossVariantStateResetRegression.test.jsx src/games/badugi/__tests__/tournamentBustedSeatEligibilityRegression.test.js src/ui/__tests__/tournamentBustedSeatDisplayRegression.test.jsx`
- Result: PASS, 13 files / 32 tests.

Focused Playwright P0/P0-P1 E2E:
- Command: `npx playwright test tests/e2e/badugi-cash-opening-actor-freeze.spec.ts tests/e2e/badugi-tournament-bet-to-draw-regression.spec.ts tests/e2e/badugi-tournament-draw1-cpu-action-regression.spec.ts tests/e2e/badugi-folded-draw-freeze-regression.spec.ts tests/e2e/physical-cross-variant-badugi-contamination-regression.spec.ts tests/e2e/tournament-busted-seat-readability.spec.ts tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts tests/e2e/mobile-tournament-visual-viewport.spec.ts --project=badugi-flow`
- Result: PASS, 17/17.

Badugi browser gameplay integration matrix:
- Command: `env BROWSER_GAMEPLAY_VARIANTS=badugi BROWSER_GAMEPLAY_MODES=cash,tournament BROWSER_GAMEPLAY_VIEWPORTS=desktop,portrait,landscape BROWSER_GAMEPLAY_HANDS=1 BROWSER_GAMEPLAY_MAX_STEPS=90 BROWSER_GAMEPLAY_REPORT_LABEL=p0-top10-badugi-matrix npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow`
- Result: PASS, 6/6.
- Covered cells: Cash desktop, Cash portrait, Cash landscape, Tournament desktop, Tournament portrait, Tournament landscape.

Mobile/tournament layout and visual viewport gates:
- Command: `npx playwright test tests/e2e/core5-mobile-tournament-layout-regression.spec.ts tests/e2e/core5-mobile-tournament-landscape-layout.spec.ts tests/e2e/mobile-tournament-readability.spec.ts tests/e2e/mobile-battlefield-ratio.spec.ts tests/e2e/mobile-layout-mode-regression.spec.ts tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts tests/e2e/iphone-safari-tournament-landscape-controls.spec.ts tests/e2e/mobile-tournament-visual-viewport.spec.ts --project=badugi-flow`
- Result: PASS, 54/54.
- Includes 390x844, 430x932, 844x390, and 932x430 tournament layout coverage for Core5 where those specs define the viewports.

Historical regression guard:
- `npm run test:game:known-bugs`: PASS, 42/42.
- Initial combined guard exposed a false audit failure in `core5-action-order-audit.spec.ts` for S02 auto-progress observation.
- After the audit correction:
  - `npx playwright test tests/e2e/core5-action-order-audit.spec.ts --project=badugi-flow`: PASS, 5/5.
  - `npx playwright test tests/e2e/core5-action-order-audit.spec.ts tests/e2e/core5-impossible-transition.spec.ts tests/e2e/core5-cash-full-lifecycle-gate.spec.ts tests/e2e/core5-tournament-full-lifecycle-gate.spec.ts --project=badugi-flow`: PASS, 17/17.

Historical checks covered:
- actor legality: PASS
- stale turn / terminal actor: PASS
- impossible DRAW/BET mixed state: PASS
- cash lifecycle: PASS
- tournament lifecycle: PASS
- folded-player revival regression coverage: PASS
- all-in illegal actor regression coverage: PASS
- next-hand/result reachability via lifecycle gates: PASS
- mobile control visibility and viewport clipping: PASS

## Tracking Decision

Do not close or move these blockers to the ledger yet.

Reason:
- All 10 target rows are physical-QA-required or tied to physical mobile QA.
- Playwright/emulation evidence is current and passing, but real iPhone Safari/PWA proof is still missing.
- `ACTIVE_BLOCKERS.md` and `PHYSICAL_QA_PENDING.md` should remain the owning tracker until device evidence is attached and historical guards pass again.

## Next Action

Run physical QA in this order:
1. `BADUGI-CASH-OPENING-ACTOR-001` on iPhone Safari Badugi cash.
2. Badugi tournament physical path covering `BADUGI-BET-DRAW-TRANSITION-001`, `BADUGI-DRAW-BET-MIX-001`, `BADUGI-DRAW1-CPU-ACTION-001`, `BADUGI-FOLD-DRAW-FREEZE-001`, and `PHYSICAL-MOBILE-BADUGI-WAITING-001`.
3. Cross-variant cash-to-Badugi tournament path for `CROSS-VARIANT-STATE-001` and `BADUGI-HAND-SHAPE-001`.
4. Tournament busted-seat and landscape controls path for `TOUR-SEAT-LIFECYCLE-001` and `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`.

If physical QA reproduces any issue:
- export freeze/snapshot JSON,
- add a focused failing regression from that exact evidence,
- fix only the root cause,
- rerun the affected matrix and historical guard before tracker changes.
