# MGX Core5 Browser Gameplay Matrix Audit

Date: 2026-05-17

## Result

`STEP_A_PASS__STEP_B_PARTIAL_FIX__TRIPLE_DRAW_100HAND_RUNTIME_PENDING`

The Badugi-only browser ladder was clean enough to expand. Core5 cash desktop 10-hand initially exposed a draw-variant progress-helper current-bet bug: D01/D02/S01/S02 snapshots carried blind bets in player fields while `currentBet` read as `0`, causing the helper to choose `CHECK`. The helper now derives current bet from draw-variant player bets when explicit street fields are absent, while preserving Badugi's stricter handling of cumulative `betThisRound`.

After that fix, Step A passed for all Core5 variants. Step B initially failed during the 100-hand cash desktop run, so expansion stopped. The focused Step B fixes now clear the Single Draw late-hand P0 and the D02 CPU draw fallback failure in shorter confirmation runs, but D01/D02 100-hand completion remains too slow/pending. Tournament, mobile, and live expansion remain blocked until the Triple Draw 100-hand runtime gate is resolved.

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

`PARTIAL_FIX / NOT_RELEASE_PASS`

Observed failure classes:

| Class | Variant Evidence | Classification | Notes |
|---|---|---|---|
| `ACTION_APPLICATION_FAILED` | S01/S02 cash desktop 100-hand | FIXED_LOCAL | Hidden/disabled action controls were counted as interactable by the helper; focused S01/S02 regression now passes and S01/S02 100-hand pass. |
| `ACTION_APPLICATION_FAILED` | D02 cash desktop hand 9 | FIXED_LOCAL_FOR_30HAND | CPU controller draw could return no snapshot and stop before legacy draw fallback; D02 30-hand now passes. D02 100-hand still needs completion proof. |
| `UI_CONTROLLER_DIVERGENCE` | S01/S02 cash desktop long run | FIXED_LOCAL | No stale Hero controls in focused S01/S02 regression after canonical actor / hidden DOM checks. |
| `PHASE` | D01/D02/S01/S02 terminal rows | P1 monitor | Controller terminal/no-actor semantics can display `SHOWDOWN · DRAW n`; no action controls are visible and result/next-hand is usable. |
| `POT` | Badugi cash desktop long run | P2 monitor | UI/controller pot timing rows persist but active-hand pot zero was not observed. |
| `BROWSER_GATE_RUNTIME_PENDING` | D01/D02 100-hand | P0 release-gate blocker | D01/D02 30-hand pass, but 100-hand runs were interrupted after roughly 30 minutes without a completed result. |

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
| D01 cash desktop 30-hand | PASS |
| D02 cash desktop 30-hand | PASS |
| D01 cash desktop 100-hand | PENDING / interrupted after roughly 30 minutes |
| D02 cash desktop 100-hand | PENDING / interrupted after roughly 30 minutes |

## Expansion Status

| Step | Status | Reason |
|---|---|---|
| A | PASS | 5/5 variants passed cash desktop 10-hand |
| B | PARTIAL_FIX / BLOCKED | S01/S02 100-hand pass; D01/D02 100-hand runtime pending |
| C | BLOCKED | Do not run tournament desktop until Step B is fixed |
| D | BLOCKED | Do not run tournament long-run until Step C passes |
| E | BLOCKED | Do not run mobile viewport matrix until desktop passes |
| F | BLOCKED | Do not run live matrix until local matrix passes |

## Next Fix List

1. Resolve D01/D02 100-hand runtime so Step B can complete as a release gate.
2. Keep S01/S02 late-hand draw/terminal regression in the matrix.
3. Keep CPU controller draw fallback under monitor in D02.
4. Re-run Step B only; do not start tournament desktop expansion until Step B reports a complete PASS.
