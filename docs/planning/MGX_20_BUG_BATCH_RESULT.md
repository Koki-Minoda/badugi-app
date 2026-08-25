# MGX 20 Bug Batch Result

Date: 2026-05-21

Scope:
- Requested maximum: 20 IDs.
- Executed target set: 14 P0/P1 IDs that exist in `docs/bugs/current_bugs.md`.
- Excluded as requested because they are P2 in `current_bugs`: `CORE5-PHASE-MACHINE-001`, `CORE5-IMPOSSIBLE-TRANSITION-001`, `CORE5-DRAW-BET-MIX-001`, `CORE5-STALE-PHASE-MERGE-001`, `DRAW-OPENING-ACTOR-001`, `CORE5-TOUR-LIVE-001`.
- Product code changes: none.
- Test gate changes: actor legality was added to mobile/layout smoke helpers so tests no longer require Hero controls when a non-Hero actor is canonical.

## Summary

Automated/emulation verification completed for all 14 target IDs. No ID was closed because every target either directly requires physical-device QA or is tied to the physical mobile alpha blocker umbrella. `current_bugs` should remain active/monitor for these rows until real-device evidence is captured.

Status legend:
- `automated/emulation verified, physical QA pending`: automated gates passed, but real iPhone/physical-device proof is still required.
- `not closed`: left in `current_bugs`; not moved to ledger.

## Changed Files

- `tests/e2e/helpers/core5LayoutAuditHelper.ts`
  - Made mobile action visibility audit actor-aware.
  - Shared-change reason: the old audit treated missing Hero controls as P0 even when canonical actor was CPU/non-Hero, contradicting actor legality and the historical guard for "hero controls visible for non-hero actor".
- `tests/e2e/helpers/gameProgressHelper.js`
  - Made `expectMobileActionsInViewport` actor-aware.
  - Shared-change reason: alpha/mobile layout tests must verify controls when legal and hidden when not legal, not always visible.
- `tests/e2e/mobile-app-smoke.spec.ts`
  - Replaced a stale DRAW-button polling loop with canonical `playOneHandProgression` requiring real Hero UI button clicks and DRAW visit.
  - Shared-change reason: the old smoke loop could not safely advance CPU actors and timed out before legal Hero DRAW states.
- `src/ui/__tests__/tournamentBustedSeatDisplayRegression.test.jsx`
  - Opened the mobile eliminated rail before asserting eliminated-player labels, matching the collapsed mobile rail behavior and E2E test.

## Batch Results

| ID | Result | Fix / Verification Summary | Tests / Gates | Tracking |
|---|---|---|---|---|
| `BADUGI-CASH-OPENING-ACTOR-001` | automated/emulation verified, physical QA pending | Existing opening actor/session snapshot regressions passed. No product change. | Focused Vitest 3 tests PASS; `badugi-cash-opening-actor-freeze.spec.ts` PASS; Badugi 6-cell browser matrix PASS; Badugi mobile portrait/layout gates PASS; historical guard PASS. | Not closed. No ledger move. 実機待ち. |
| `CROSS-VARIANT-STATE-001` | automated/emulation verified, physical QA pending | Existing cross-variant reset and controller boundary regressions passed. No product change. | Focused Vitest 5 tests PASS; physical cross-variant contamination E2E PASS; Core5 all-variant 30-cell matrix PASS; mobile visual gates PASS. | Not closed. No ledger move. 実機待ち. |
| `BADUGI-BET-DRAW-TRANSITION-001` | automated/emulation verified, physical QA pending | Existing BET-to-DRAW regressions passed. No product change. | Focused Vitest 5 tests PASS; `badugi-tournament-bet-to-draw-regression.spec.ts` PASS; Badugi 6-cell matrix PASS. | Not closed. No ledger move. 実機待ち. |
| `BADUGI-DRAW-BET-MIX-001` | automated/emulation verified, physical QA pending | Existing mixed DRAW/BET snapshot detector passed. No product change. | `drawBetMixedStateRegression.test.jsx` PASS; Badugi 6-cell matrix PASS. | Not closed. No ledger move. 実機待ち. |
| `BADUGI-DRAW1-CPU-ACTION-001` | automated/emulation verified, physical QA pending | Existing CPU DRAW action regressions passed. No product change. | Focused Vitest 3 tests PASS; `badugi-tournament-draw1-cpu-action-regression.spec.ts` PASS; Badugi 6-cell matrix PASS. | Not closed. No ledger move. 実機待ち. |
| `BADUGI-FOLD-DRAW-FREEZE-001` | automated/emulation verified, physical QA pending | Existing folded draw actor regressions passed. No product change. | Focused Vitest 5 tests PASS; `badugi-folded-draw-freeze-regression.spec.ts` PASS; Badugi 6-cell matrix PASS. | Not closed. No ledger move. 実機待ち. |
| `D01-BLIND-POSTING-001` | automated/emulation verified, physical QA pending | Existing D01 blind posting invariants passed. No product change. | Focused Vitest 4 tests PASS; `d01-blind-posting-regression.spec.ts` PASS; D01 6-cell matrix PASS. | Not closed. No ledger move. 実機待ち. |
| `TOUR-SEAT-LIFECYCLE-001` | automated/emulation verified, physical QA pending | Strengthened focused rail unit test to expand the mobile rail before checking eliminated entries. No product change. | Focused Vitest 6 tests PASS; `tournament-busted-seat-readability.spec.ts` PASS; Core5 30-cell matrix PASS. | Not closed. No ledger move. 実機待ち. |
| `UI-MOBILE-TOURNAMENT-LANDSCAPE-001` | automated/emulation verified, physical QA pending | Existing visual viewport and landscape action gates passed after actor-aware test correction. No product change. | Mobile policy suite 24 tests PASS; Core5 30-cell matrix PASS; alpha/mobile smoke PASS. | Not closed. No ledger move. 実機待ち. |
| `UI-MOBILE-TABLE-DENSITY-001` | automated/emulation verified, physical QA pending | Existing battlefield/readability gates passed. No product change. | `mobile-tournament-readability`, `mobile-battlefield-ratio`, `mobile-layout-mode-regression` included in 24-test mobile policy PASS. | Not closed. No ledger move. 実機待ち. |
| `UI-MOBILE-HUD-OVERLAY-001` | automated/emulation verified, physical QA pending | Existing HUD/readability gates passed. No product change. | Mobile policy suite 24 tests PASS; Core5 mobile tournament layout regression previously PASS. | Not closed. No ledger move. 実機待ち. |
| `UI-MOBILE-LANDSCAPE-CONTROLS-001` | automated/emulation verified, physical QA pending | Existing landscape controls and smoke gates passed after stale smoke loop correction. No product change. | `mobile-tournament-landscape-action-buttons`, `iphone-safari-tournament-landscape-controls`, `mobile-app-smoke` PASS. | Not closed. No ledger move. 実機待ち. |
| `UI-MOBILE-LAYOUT-MODE-001` | automated/emulation verified, physical QA pending | Explicit portrait/landscape layout mode gates passed. No product change. | `mobile-layout-mode-regression.spec.ts` PASS inside 24-test mobile policy suite. | Not closed. No ledger move. 実機待ち. |
| `BG-005` | automated/emulation verified, physical QA pending | Umbrella mobile QA remains open because physical QA is still required. Supplemental alpha/mobile smoke now passes after test gate correction. | `alpha-mobile-gameplay-layout.spec.ts` PASS; `mobile-app-smoke.spec.ts` PASS; historical guard PASS. | Not closed. No ledger move. 実機待ち. |

## Six-Cell Integration Results

Badugi targeted 6-cell matrix:
- Cash PC: PASS
- Cash mobile portrait: PASS
- Cash mobile landscape: PASS
- Tournament PC: PASS
- Tournament mobile portrait: PASS
- Tournament mobile landscape: PASS

D01 targeted 6-cell matrix:
- Cash PC: PASS
- Cash mobile portrait: PASS
- Cash mobile landscape: PASS
- Tournament PC: PASS
- Tournament mobile portrait: PASS
- Tournament mobile landscape: PASS

Shared Core5 30-cell matrix:
- Variants: Badugi, D01, D02, S01, S02
- Modes: Cash, Tournament
- Viewports: desktop, portrait, landscape
- Result: PASS, 30/30

Mobile policy matrix:
- `iphone-safari-tournament-landscape-controls.spec.ts`: PASS
- `mobile-battlefield-ratio.spec.ts`: PASS
- `mobile-layout-mode-regression.spec.ts`: PASS
- `mobile-tournament-landscape-action-buttons.spec.ts`: PASS
- `mobile-tournament-readability.spec.ts`: PASS
- `mobile-tournament-visual-viewport.spec.ts`: PASS
- Combined result: PASS, 24/24

Alpha/mobile smoke:
- `alpha-mobile-gameplay-layout.spec.ts`: PASS after actor-aware helper correction.
- `mobile-app-smoke.spec.ts`: PASS after replacing stale draw polling with canonical progression.

## Historical Regression Guard

Final guard run after all test changes:
- `npm run test:game:known-bugs`: PASS, 42/42
- `core5-action-order-audit.spec.ts`: PASS, 5/5
- `core5-impossible-transition.spec.ts`: PASS, 2/2
- `core5-cash-full-lifecycle-gate.spec.ts`: PASS, 5/5
- `core5-tournament-full-lifecycle-gate.spec.ts`: PASS, 5/5

Guard coverage confirmed:
- stale actor: PASS
- no-next-actor: PASS
- folded player revival: PASS
- all-in illegal actor: PASS
- terminal stale turn: PASS
- pot continuity: PASS
- next-hand recovery: PASS
- mobile control visibility: PASS
- tournament result path: PASS

## Current Bugs And Ledger Status

- `current_bugs` close status: no target ID closed.
- `current_bugs` update status: no row moved out of active/monitor because physical-device evidence is still missing.
- Ledger migration status: no target ID moved to `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`.
- Reason: user rule requires physical QA proof before close/ledger for the physical mobile blocker IDs, and all 14 target IDs remain tied to that evidence path.

## Physical QA Pending IDs

- `BADUGI-CASH-OPENING-ACTOR-001`
- `CROSS-VARIANT-STATE-001`
- `BADUGI-BET-DRAW-TRANSITION-001`
- `BADUGI-DRAW-BET-MIX-001`
- `BADUGI-DRAW1-CPU-ACTION-001`
- `BADUGI-FOLD-DRAW-FREEZE-001`
- `D01-BLIND-POSTING-001`
- `TOUR-SEAT-LIFECYCLE-001`
- `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`
- `UI-MOBILE-TABLE-DENSITY-001`
- `UI-MOBILE-HUD-OVERLAY-001`
- `UI-MOBILE-LANDSCAPE-CONTROLS-001`
- `UI-MOBILE-LAYOUT-MODE-001`
- `BG-005`

## Remaining P0/P1

Remaining P0/P1 are the same 14 target rows until physical QA evidence is added and accepted. Automated/emulation proof is now current, but release status remains blocked by physical-device verification.

## Next ID

Next engineering action:
- Run the physical iPhone Safari/PWA QA path for `BADUGI-CASH-OPENING-ACTOR-001` first, then the Badugi tournament physical path covering `BADUGI-BET-DRAW-TRANSITION-001`, `BADUGI-DRAW-BET-MIX-001`, `BADUGI-DRAW1-CPU-ACTION-001`, and `BADUGI-FOLD-DRAW-FREEZE-001`.

Next code action only if physical QA reproduces:
- Capture the failing snapshot/export.
- Add a focused failing regression from that exact snapshot.
- Fix only the corresponding root cause.
- Rerun the affected 6-cell matrix and historical guard before updating tracking.
