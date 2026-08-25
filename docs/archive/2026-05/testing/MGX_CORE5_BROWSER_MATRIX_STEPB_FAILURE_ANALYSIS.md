# MGX Core5 Browser Matrix Step B Failure Analysis

Date: 2026-05-17

## Scope

Step B is `Core5 cash desktop 100-hand` for:

| Variant | Game |
|---|---|
| Badugi | Badugi |
| D01 | 2-7 Triple Draw |
| D02 | A-5 Triple Draw |
| S01 | 2-7 Single Draw |
| S02 | A-5 Single Draw |

Expansion to tournament, mobile, and live remains blocked until Step B is clean.

## Failure Summary

| Variant | Hand / Action | Failure | Classification | Status |
|---|---:|---|---|---|
| S01 | hand 8, DRAW actor 2 | `ACTION_APPLICATION_FAILED` during non-hero draw | `PROGRESS_HELPER_BUG` plus stale draw fallback timing | Fixed locally; S01 100-hand PASS |
| S02 | hand 27, BET/DRAW terminal edge | stale actor after all calls/folds, then draw attempted after fold-win | `REAL_UI_MERGE_BUG` / round-closure guard gap | Fixed locally; S02 100-hand PASS |
| D02 | hand 9, DRAW actor 4 | CPU draw controller returned no snapshot and no fallback progressed | `REAL_UI_MERGE_BUG` / controller draw fallback gap | Fixed locally for 30-hand; 100-hand runtime pending |
| D01 | 100-hand run | no invariant P0 observed before manual stop, but 100-hand run exceeded practical runtime | `BROWSER_GATE_RUNTIME_PENDING` | 30-hand PASS; 100-hand pending |

## Root Causes

| Root Cause | Evidence | Fix |
|---|---|---|
| Hidden action buttons were counted as interactable by the progress helper | Focused S01/S02 regression saw `getLegalActions()` return stale action controls while browser snapshot reported `heroControlsVisible=false` | `tests/e2e/helpers/gameProgressHelper.js` now rejects hidden/disabled ancestors and pointer-blocked controls |
| Single-winner / completed-bet states could be auto-progressed as if a stale actor still needed action | S02 trace showed all obligations resolved, then stale actor auto action, then DRAW after a fold-win collect | `src/ui/App.jsx` now checks `isBetRoundComplete` before NPC auto bet and ends one-left BET/DRAW states before electing another actor |
| CPU controller draw could fail without falling back to the existing deck-managed draw path | D02 trace showed non-hero DRAW actor with no applied action and no controller failure details | `src/ui/App.jsx` now falls through to legacy draw fallback when controller CPU draw rejects or returns no snapshot |
| P1 monitor rows caused excessive retry cost in the browser matrix harness | Long Step B runs spent retries on terminal phase display lag rows | `tests/e2e/browser-gameplay-invariant-harness.spec.ts` retries only P0 rows and keeps P1 rows as monitor evidence |

## Trace Evidence

| Artifact | Path |
|---|---|
| S01 trace | `reports/browser-gameplay/browser-gameplay-trace-s01-cash-desktop.jsonl` |
| S02 trace | `reports/browser-gameplay/browser-gameplay-trace-s02-cash-desktop.jsonl` |
| D01 trace | `reports/browser-gameplay/browser-gameplay-trace-d01-cash-desktop.jsonl` |
| D02 trace | `reports/browser-gameplay/browser-gameplay-trace-d02-cash-desktop.jsonl` |
| Failure summary | `reports/browser-gameplay/browser-gameplay-invariant-failures.json` |
| Failure screenshots | `reports/screenshots/browser-gameplay-failure-*.png` |

Generated reports and screenshots are intentionally not committed.

## Verification

| Command | Result |
|---|---|
| `npx playwright test tests/e2e/core5-sd-late-hand-draw-terminal-divergence.spec.ts --project=badugi-flow` | PASS, 2/2 |
| `BROWSER_GAMEPLAY_HANDS=30 BROWSER_GAMEPLAY_VARIANTS=D01 ...` | PASS |
| `BROWSER_GAMEPLAY_HANDS=30 BROWSER_GAMEPLAY_VARIANTS=D02 ...` | PASS after fallback fix |
| `BROWSER_GAMEPLAY_HANDS=100 BROWSER_GAMEPLAY_VARIANTS=S01 ...` | PASS |
| `BROWSER_GAMEPLAY_HANDS=100 BROWSER_GAMEPLAY_VARIANTS=S02 ...` | PASS |
| `BROWSER_GAMEPLAY_HANDS=100 BROWSER_GAMEPLAY_VARIANTS=D01 ...` | Interrupted after roughly 30 minutes without a completed result |
| `BROWSER_GAMEPLAY_HANDS=100 BROWSER_GAMEPLAY_VARIANTS=D02 ...` | Interrupted after roughly 30 minutes without a completed result |

## Current Decision

`STEP_B_PARTIAL_FIX__TRIPLE_DRAW_100HAND_RUNTIME_PENDING`

The original Single Draw late-hand P0 is fixed locally. D02's controller draw fallback failure is fixed for 30-hand coverage. Step B as a release gate is still not PASS because D01/D02 100-hand completion remains too slow/pending, so tournament desktop expansion is not reached.

