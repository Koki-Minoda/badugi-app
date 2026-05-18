# MGX Core5 Browser Gameplay Matrix Audit

Date: 2026-05-18

## Result

`STEP_A_PASS__STEP_B_PASS__STEP_C_PASS__STEP_D_PASS__MOBILE_MATRIX_READY`

The Badugi-only browser ladder was clean enough to expand. Core5 cash desktop 10-hand initially exposed a draw-variant progress-helper current-bet bug: D01/D02/S01/S02 snapshots carried blind bets in player fields while `currentBet` read as `0`, causing the helper to choose `CHECK`. The helper now derives current bet from draw-variant player bets when explicit street fields are absent, while preserving Badugi's stricter handling of cumulative `betThisRound`.

After that fix, Step A passed for all Core5 variants. Step B initially failed during the 100-hand cash desktop run, so expansion stopped. The focused Step B fixes clear the Single Draw late-hand P0 and add a D02 CPU draw fallback. The later D01 fold-to-one collect terminal path is covered by focused unit/UI/E2E regressions. A subsequent D01 actor/source divergence around hand `D03-h28-d2-mpaebgvh` was traced to the browser collector and E2E progress helper mixing stale `phaseState` fields with the current session controller snapshot. The collector/helper now prefer `controllerSnapshot` for phase, players, and hand id. D01 30-hand, D01 100-hand, and D02 100-hand now pass.

Step C initially exposed a tournament-only draw-lowball action application gap: D01/D02/S01/S02 tournament snapshots were controller-backed, but the E2E/controller action path only applied actions through `sessionControllerRef`, which was absent after tournament mode initialization. The fix allows Core5 controller-backed tournament variants to preserve/use their session controller, falls back to the active draw-lowball `gameControllerRef` when needed, and exposes E2E controller-action diagnostics. Step C and Step D now pass locally for Core5 tournament desktop.

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
| E | READY TO RUN | Mobile portrait/landscape matrix is now allowed next, but was not run in this step |
| F | BLOCKED | Do not run live matrix until local matrix passes |

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

## Next Fix List

1. Start Core5 portrait/landscape local browser matrix next.
2. Keep S01/S02 late-hand draw/terminal regression, D02 draw fallback, D01 terminal collect, and tournament draw-lowball controller-action fallback under monitor.
3. Do not start live matrix until the local mobile viewport matrix passes.
