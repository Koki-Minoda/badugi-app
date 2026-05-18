# MGX Core5 Browser Gameplay Matrix Audit

Date: 2026-05-18

## Result

`STEP_A_PASS__STEP_B_PASS__STEP_C_PASS__STEP_D_PASS__STEP_E_PASS__LOCAL_MOBILE_MATRIX_CLEAN`

The Badugi-only browser ladder was clean enough to expand. Core5 cash desktop 10-hand initially exposed a draw-variant progress-helper current-bet bug: D01/D02/S01/S02 snapshots carried blind bets in player fields while `currentBet` read as `0`, causing the helper to choose `CHECK`. The helper now derives current bet from draw-variant player bets when explicit street fields are absent, while preserving Badugi's stricter handling of cumulative `betThisRound`.

After that fix, Step A passed for all Core5 variants. Step B initially failed during the 100-hand cash desktop run, so expansion stopped. The focused Step B fixes clear the Single Draw late-hand P0 and add a D02 CPU draw fallback. The later D01 fold-to-one collect terminal path is covered by focused unit/UI/E2E regressions. A subsequent D01 actor/source divergence around hand `D03-h28-d2-mpaebgvh` was traced to the browser collector and E2E progress helper mixing stale `phaseState` fields with the current session controller snapshot. The collector/helper now prefer `controllerSnapshot` for phase, players, and hand id. D01 30-hand, D01 100-hand, and D02 100-hand now pass.

Step C initially exposed a tournament-only draw-lowball action application gap: D01/D02/S01/S02 tournament snapshots were controller-backed, but the E2E/controller action path only applied actions through `sessionControllerRef`, which was absent after tournament mode initialization. The fix allows Core5 controller-backed tournament variants to preserve/use their session controller, falls back to the active draw-lowball `gameControllerRef` when needed, and exposes E2E controller-action diagnostics. Step C and Step D now pass locally for Core5 tournament desktop.

Step E initially exposed a mobile-only D01 tournament portrait UI/controller divergence in the 50-hand matrix: the controller actor advanced to a non-Hero seat, but stale Hero action controls remained interactable in the DOM. The fix stores the controller UI snapshot in React state and includes `currentActor` when syncing engine snapshots, so controls render from the canonical controller actor instead of stale legacy turn state. Focused D01 tournament portrait 50-hand, Core5 mobile 20-hand, and Core5 mobile 50-hand now pass locally.

Physical mobile Badugi later exposed a narrower tournament P0 outside the local matrix: a closed BET Draw2 state with no pending actors could remain in BET/waiting instead of entering DRAW. The focused `badugi-tournament-bet-to-draw-regression.spec.ts` now covers this state. Root cause was stale BET street flags and transition deferral around BET→DRAW / DRAW→BET handling: a closed BET round could keep prior street bets/acted flags and an empty actor. The local fix resets DRAW and next-BET street flags at phase boundaries, prevents stale transition guards from dropping forced BET closure, and adds a closed-BET guard before re-electing a fallback actor.

Post-deploy live Badugi tournament mobile emulation still fails before clearing the release gate: both portrait and landscape stop at DRAW1 with actor seat 2 because the live MTT path reports `ACTION_APPLICATION_FAILED` / `controller action returned no snapshot` for CPU draw forcing. This is tracked separately from the original closed-BET Draw2 regression; do not mark the physical Badugi gate clear until the live DRAW1 action-application failure is fixed or classified and the live matrix passes.

## Step A: Core5 Cash Desktop 10-Hand

Command:

```bash
BROWSER_GAMEPLAY_HANDS=10 \
BROWSER_GAMEPLAY_VARIANTS=badugi,D01,D02,S01,S02 \
BROWSER_GAMEPLAY_MODES=cash \
BROWSER_GAMEPLAY_VIEWPORTS=desktop \
npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow
```

Result:

| Variant | Result |
|---|---|
| Badugi | PASS |
| D01 / 2-7 Triple Draw | PASS |
| D02 / A-5 Triple Draw | PASS |
| S01 / 2-7 Single Draw | PASS |
| S02 / A-5 Single Draw | PASS |

Artifacts:

| Artifact | Path |
|---|---|
| Summary | `reports/browser-gameplay/core5-cash-desktop-10hand-summary.json` |
| Failures | `reports/browser-gameplay/core5-cash-desktop-10hand-failures.json` |

## Step B: Core5 Cash Desktop 100-Hand

Command:

```bash
BROWSER_GAMEPLAY_HANDS=100 \
BROWSER_GAMEPLAY_VARIANTS=badugi,D01,D02,S01,S02 \
BROWSER_GAMEPLAY_MODES=cash \
BROWSER_GAMEPLAY_VIEWPORTS=desktop \
npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow
```

Result:

`PASS`

Observed failure classes:

| Class | Variant Evidence | Classification | Notes |
|---|---|---|---|
| `ACTION_APPLICATION_FAILED` | S01/S02 cash desktop 100-hand | FIXED_LOCAL | Hidden/disabled action controls were counted as interactable by the helper; focused S01/S02 regression now passes and S01/S02 100-hand pass. |
| `ACTION_APPLICATION_FAILED` | D02 cash desktop hand 9 | FIXED_LOCAL | CPU controller draw could return no snapshot and stop before legacy draw fallback; D02 100-hand now passes. |
| `UI_CONTROLLER_DIVERGENCE` | S01/S02 cash desktop long run | FIXED_LOCAL | No stale Hero controls in focused S01/S02 regression after canonical actor / hidden DOM checks. |
| `PHASE` | D01/D02/S01/S02 terminal rows | P1 monitor | Controller terminal/no-actor semantics can display `SHOWDOWN · DRAW n`; no action controls are visible and result/next-hand is usable. |
| `POT` | Badugi cash desktop long run | P2 monitor | UI/controller pot timing rows persist but active-hand pot zero was not observed. |
| `CORE5-BROWSER-TERMINAL-COLLECT-001` | Focused D01 terminal collect repro | FIXED_LOCAL / MONITOR | The original no-actor collect state now hides Hero controls and reaches terminal/result semantics. |
| `ACTOR` / `ACTION_APPLICATION_FAILED` | D01 cash desktop 30-hand, hand `D03-h28-d2-mpaebgvh` | FIXED_INFRA / MONITOR | The false P0 came from mixed snapshot sources: actor from controller snapshot, but phase/players from stale `phaseState`. D01 30-hand and D01 100-hand now pass after source-priority correction. |
| `CORE5-BROWSER-RUNTIME-001` | D01/D02 100-hand | FIXED_INFRA / MONITOR | D01 100-hand and D02 100-hand complete within the extended runtime budget with no invariant P0 or real freeze. |

Artifacts:

| Artifact | Path |
|---|---|
| Summary | `reports/browser-gameplay/core5-cash-desktop-100hand-summary.json` |
| Failures | `reports/browser-gameplay/core5-cash-desktop-100hand-failures.json` |
| Badugi trace | `reports/browser-gameplay/browser-gameplay-trace-badugi-cash-desktop.jsonl` |
| D01 trace | `reports/browser-gameplay/browser-gameplay-trace-d01-cash-desktop.jsonl` |
| S02 trace | `reports/browser-gameplay/browser-gameplay-trace-s02-cash-desktop.jsonl` |
| Failure screenshots | `reports/screenshots/browser-gameplay-failure-*.png` |

## Step B Focused Rechecks

| Check | Result |
|---|---|
| S01/S02 late-hand draw/terminal focused regression | PASS, 2/2 |
| S01 cash desktop 100-hand | PASS |
| S02 cash desktop 100-hand | PASS |
| D01 fold-to-one collect focused unit/UI/E2E | PASS |
| D01 cash desktop 30-hand, stricter completion gate | PASS |
| D01 cash desktop 100-hand | PASS |
| D02 cash desktop 100-hand | PASS |

## Expansion Status

| Step | Status | Reason |
|---|---|---|
| A | PASS | 5/5 variants passed cash desktop 10-hand |
| B | PASS | Core5 cash desktop 100-hand is now clean for D01/D02/S01/S02 plus prior Badugi ladder |
| C | PASS | Core5 tournament desktop 20-hand passed, 5/5 variants |
| D | PASS | Core5 tournament desktop 100-hand passed, 500/500 hands, 0 invariant violations |
| E | PASS | Core5 portrait/landscape 10-hand, 20-hand, and 50-hand local mobile matrices pass |
| F | PASS | Live preview browser smoke, desktop matrix, and mobile emulation matrix pass against `https://mgx-poker.com/` |

## Step C/D Tournament Desktop Recheck

| Check | Result |
|---|---|
| Step C 20-hand | PASS, 5/5 variants |
| Step D 100-hand | PASS, 5/5 variants |
| Hands attempted/completed | 500/500 in Step D |
| Actions observed | 13,062 |
| Raises / calls / folds / draws / re-raises | 796 / 7,671 / 313 / 4,282 / 659 |
| Invariant violations | 0 |
| Fatal console/page errors | 0 observed by the harness |

Artifacts:

| Artifact | Path |
|---|---|
| Tournament desktop summary | `reports/browser-gameplay/browser-gameplay-invariant-summary.json` |
| Tournament desktop failures | `reports/browser-gameplay/browser-gameplay-invariant-failures.json` |
| Badugi trace | `reports/browser-gameplay/browser-gameplay-trace-badugi-tournament-desktop.jsonl` |
| D01 trace | `reports/browser-gameplay/browser-gameplay-trace-d01-tournament-desktop.jsonl` |
| D02 trace | `reports/browser-gameplay/browser-gameplay-trace-d02-tournament-desktop.jsonl` |
| S01 trace | `reports/browser-gameplay/browser-gameplay-trace-s01-tournament-desktop.jsonl` |
| S02 trace | `reports/browser-gameplay/browser-gameplay-trace-s02-tournament-desktop.jsonl` |

## Step E Mobile Portrait/Landscape Recheck

Commands:

```bash
BROWSER_GAMEPLAY_HANDS=10 \
BROWSER_GAMEPLAY_VARIANTS=badugi,D01,D02,S01,S02 \
BROWSER_GAMEPLAY_MODES=cash,tournament \
BROWSER_GAMEPLAY_VIEWPORTS=portrait,landscape \
BROWSER_TRACE_MODE=light \
BROWSER_RUNTIME_TELEMETRY=1 \
npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow

BROWSER_GAMEPLAY_HANDS=20 \
BROWSER_GAMEPLAY_VARIANTS=badugi,D01,D02,S01,S02 \
BROWSER_GAMEPLAY_MODES=cash,tournament \
BROWSER_GAMEPLAY_VIEWPORTS=portrait,landscape \
BROWSER_TRACE_MODE=light \
BROWSER_RUNTIME_TELEMETRY=1 \
BROWSER_GAMEPLAY_TIMEOUT_MS=5400000 \
npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow

BROWSER_GAMEPLAY_HANDS=50 \
BROWSER_GAMEPLAY_VARIANTS=badugi,D01,D02,S01,S02 \
BROWSER_GAMEPLAY_MODES=cash,tournament \
BROWSER_GAMEPLAY_VIEWPORTS=portrait,landscape \
BROWSER_TRACE_MODE=light \
BROWSER_RUNTIME_TELEMETRY=1 \
BROWSER_GAMEPLAY_TIMEOUT_MS=5400000 \
npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow
```

Result:

| Check | Result |
|---|---|
| Mobile smoke 10-hand | PASS, 20/20 combinations |
| Mobile 20-hand matrix | PASS, 20/20 combinations |
| Mobile 50-hand matrix | PASS, 20/20 combinations |
| Hands attempted/completed in 50-hand | 1000/1000 |
| Actions observed in 50-hand | 23,358 |
| Raises / calls / folds / draws / re-raises | 1,295 / 13,615 / 539 / 7,909 / 1,003 |
| Actor P0 / terminal P0 / illegal reopen / UI divergence / action application failed | 0 / 0 / 0 / 0 / 0 |
| Monitor rows | 245 PHASE P1 and 23 POT P1 timing rows, all without stale controls or active-hand pot-zero P0 |

Focused failure recheck:

| Check | Result |
|---|---|
| D01 tournament portrait 50-hand after stale-controls fix | PASS |
| Original failure class | `UI_CONTROLLER_DIVERGENCE`, D01 tournament portrait, non-Hero controller actor with stale Hero controls |
| Classification | REAL_UI_MERGE_BUG / FIXED_LOCAL |

Artifacts:

| Artifact | Path |
|---|---|
| Mobile summary | `reports/browser-gameplay/browser-gameplay-invariant-summary.json` |
| Mobile failures/monitor rows | `reports/browser-gameplay/browser-gameplay-invariant-failures.json` |
| D01 tournament portrait trace | `reports/browser-gameplay/browser-gameplay-trace-d01-tournament-portrait.jsonl` |
| D02 tournament portrait trace | `reports/browser-gameplay/browser-gameplay-trace-d02-tournament-portrait.jsonl` |
| S01 tournament landscape trace | `reports/browser-gameplay/browser-gameplay-trace-s01-tournament-landscape.jsonl` |
| S02 tournament landscape trace | `reports/browser-gameplay/browser-gameplay-trace-s02-tournament-landscape.jsonl` |
| Failure/monitor screenshots | `reports/screenshots/browser-gameplay-failure-*.png` |

## Step F Live Preview Matrix

Live URL: `https://mgx-poker.com/`

| Check | Result |
|---|---|
| Deploy verification | PASS, deployed commit matches local head `a2a271e4b426581fcdb7c156d1aa90b1ed607a00` |
| Live smoke 5-hand desktop | PASS, 50/50 hands complete |
| Live desktop 20-hand matrix | PASS, 200/200 hands complete |
| Live mobile emulation 10-hand matrix | PASS, 200/200 hands complete |
| Actor P0 / terminal P0 / illegal reopen / UI divergence / action application failed / freeze | 0 / 0 / 0 / 0 / 0 / 0 |
| Monitor rows | PHASE/POT timing rows only, no stale controls or active-hand pot-zero P0 |
| Badugi no-reraise closure | PASS live |
| Badugi re-raise-positive proof | PASS live after explicit fixed-limit raise increment |

Artifacts:

| Artifact | Path |
|---|---|
| Deploy verification | `reports/alpha/live-deploy-verification.json` |
| Live smoke summary | `reports/browser-gameplay/live-core5-smoke-summary.json` |
| Live smoke failures/monitor rows | `reports/browser-gameplay/live-core5-smoke-failures.json` |
| Live desktop summary | `reports/browser-gameplay/live-core5-desktop-20hand-summary.json` |
| Live desktop failures/monitor rows | `reports/browser-gameplay/live-core5-desktop-20hand-failures.json` |
| Live mobile summary | `reports/browser-gameplay/live-core5-mobile-10hand-summary.json` |
| Live mobile failures/monitor rows | `reports/browser-gameplay/live-core5-mobile-10hand-failures.json` |
| Badugi betting closure | `reports/alpha/live-badugi-betting-closure.json` |

## Phase Machine Hardening Recheck

Added release-gate detectors:

| Detector | Scope | Result |
|---|---|---|
| Legal phase graph | Core5 `BET` / `DRAW` / `SHOWDOWN` / `COLLECT` / `RESULT` / `NEXT_HAND` transitions, with Badugi/D01/D02 max draw 3 and S01/S02 max draw 1 | PASS |
| Impossible transition detector | illegal graph edge, phase regression, illegal draw sequence, terminal actor, collect-with-pending-action, multi-actor state | PASS |
| DRAW/BET mixed snapshot detector | `BET` with active draw controls, or `DRAW` with active betting controls / raise path | PASS |
| Stale phase merge detector | controller snapshot phase/actor/drawRound overridden by stale session/legacy/metadata state | PASS |

Focused tests:

| Test | Result |
|---|---|
| `src/games/_core/__tests__/phaseMachineGraph.test.js` | PASS, 4/4 |
| `src/ui/__tests__/drawBetMixedStateRegression.test.jsx` | PASS, 3/3 |
| `src/ui/__tests__/stalePhaseMergeRegression.test.jsx` | PASS, 4/4 |
| `tests/e2e/core5-impossible-transition.spec.ts` | PASS, 2/2 |
| `tests/e2e/core5-phase-machine-regression.spec.ts` | PASS, 5/5 variants sampled |

Browser matrix evidence:

| Check | Result |
|---|---|
| Full local Core5 50-hand matrix with phase detectors | PASS for P0, 30/30 combinations, 1500/1500 hands complete, 33,964 actions observed |
| Full matrix hard P0 rows | 0 actor / 0 terminal / 0 illegal reopen / 0 action application / 0 impossible transition / 0 DRAW-BET mixed / 0 controller-source stale merge |
| Initial full matrix monitor rows | 370 displayed PHASE P1, 27 POT P1, and duplicated displayed-phase `STALE_PHASE_MERGE` P1 rows |
| Detector classification fix | PASS, displayed phase lag is now classified only as `PHASE` monitor, not stale source merge |
| Post-classification Core5 5-hand matrix | PASS, 30/30 combinations, 150/150 hands complete, 4,078 actions observed |
| Post-classification violations | 43 PHASE P1 and 1 POT P1 timing rows; 0 `STALE_PHASE_MERGE`, 0 `DRAW_BET_MIXED_STATE`, 0 `IMPOSSIBLE_PHASE_TRANSITION`, 0 `TERMINAL_WITH_ACTOR` |

Artifacts:

| Artifact | Path |
|---|---|
| Phase spec | `docs/testing/MGX_CORE5_PHASE_MACHINE_SPEC.md` |
| Matrix summary | `reports/browser-gameplay/browser-gameplay-invariant-summary.json` |
| Matrix failures/monitor rows | `reports/browser-gameplay/browser-gameplay-invariant-failures.json` |
| Phase regression report | `reports/phase-machine/core5-phase-machine-regression.json` |

## Next Fix List

1. Keep S01/S02 late-hand draw/terminal regression, D02 draw fallback, D01 terminal collect, D01 mobile stale-controls fix, tournament draw-lowball controller-action fallback, and live matrix monitor rows under release-gate monitor.
2. Keep phase-machine detectors enabled in browser/live/physical QA so DRAW/BET mixed screenshots become traceable P0 rows instead of ambiguous UI symptoms.
3. D01 blind posting / display invariant now has a focused local gate: engine posts SB/BB, UI position badges use controller `dealerIndex`, and browser export includes `blindPosting` expected/actual/displayed values. Physical mobile must still verify this on live after deploy.
4. Keep friend alpha HOLD until physical mobile QA and remote sync are resolved.
