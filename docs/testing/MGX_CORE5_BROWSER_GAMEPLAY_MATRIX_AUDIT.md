# MGX Core5 Browser Gameplay Matrix Audit

Date: 2026-05-18

## Result

`STEP_A_PASS__STEP_B_PASS__TOURNAMENT_DESKTOP_READY`

The Badugi-only browser ladder was clean enough to expand. Core5 cash desktop 10-hand initially exposed a draw-variant progress-helper current-bet bug: D01/D02/S01/S02 snapshots carried blind bets in player fields while `currentBet` read as `0`, causing the helper to choose `CHECK`. The helper now derives current bet from draw-variant player bets when explicit street fields are absent, while preserving Badugi's stricter handling of cumulative `betThisRound`.

After that fix, Step A passed for all Core5 variants. Step B initially failed during the 100-hand cash desktop run, so expansion stopped. The focused Step B fixes clear the Single Draw late-hand P0 and add a D02 CPU draw fallback. The later D01 fold-to-one collect terminal path is covered by focused unit/UI/E2E regressions. A subsequent D01 actor/source divergence around hand `D03-h28-d2-mpaebgvh` was traced to the browser collector and E2E progress helper mixing stale `phaseState` fields with the current session controller snapshot. The collector/helper now prefer `controllerSnapshot` for phase, players, and hand id. D01 30-hand, D01 100-hand, and D02 100-hand now pass; tournament desktop expansion is allowed.

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
| C | READY TO RUN | Tournament desktop 20-hand expansion is now allowed |
| D | BLOCKED | Do not run tournament long-run until Step C passes |
| E | BLOCKED | Do not run mobile viewport matrix until desktop passes |
| F | BLOCKED | Do not run live matrix until local matrix passes |

## Next Fix List

1. Start Core5 tournament desktop 20-hand expansion.
2. Keep S01/S02 late-hand draw/terminal regression, D02 draw fallback, and D01 terminal collect under monitor.
3. Do not start mobile/live matrix until local tournament desktop passes.
