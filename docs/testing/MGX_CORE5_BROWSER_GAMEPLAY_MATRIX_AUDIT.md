# MGX Core5 Browser Gameplay Matrix Audit

Date: 2026-05-17

## Result

`STEP_A_PASS__STEP_B_FAIL`

The Badugi-only browser ladder was clean enough to expand. Core5 cash desktop 10-hand initially exposed a draw-variant progress-helper current-bet bug: D01/D02/S01/S02 snapshots carried blind bets in player fields while `currentBet` read as `0`, causing the helper to choose `CHECK`. The helper now derives current bet from draw-variant player bets when explicit street fields are absent, while preserving Badugi's stricter handling of cumulative `betThisRound`.

After that fix, Step A passed for all Core5 variants. Step B failed during the 100-hand cash desktop run, so expansion stopped.

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

`FAIL`

Observed failure classes:

| Class | Variant Evidence | Classification | Notes |
|---|---|---|---|
| `ACTION_APPLICATION_FAILED` | Badugi, D01, D02, S01, S02 command output | NEEDS_REPRO | The harness selected a canonical actor action that the E2E driver could not apply. This may be helper action selection or a real stale actor/phase state depending on trace. |
| `UI_CONTROLLER_DIVERGENCE` | S01/S02 cash desktop long run | P0 | Hero controls visible while controller actor was a non-hero seat in a draw/late-hand state. |
| `PHASE` | D01/S01/S02 cash desktop long run | P1 | Controller had terminal/no-actor semantics while displayed phase lagged as BET/DRAW. |
| `POT` | Badugi cash desktop long run | P2 monitor | UI/controller pot timing rows persist but active-hand pot zero was not observed. |

Artifacts:

| Artifact | Path |
|---|---|
| Summary | `reports/browser-gameplay/core5-cash-desktop-100hand-summary.json` |
| Failures | `reports/browser-gameplay/core5-cash-desktop-100hand-failures.json` |
| Badugi trace | `reports/browser-gameplay/browser-gameplay-trace-badugi-cash-desktop.jsonl` |
| D01 trace | `reports/browser-gameplay/browser-gameplay-trace-d01-cash-desktop.jsonl` |
| S02 trace | `reports/browser-gameplay/browser-gameplay-trace-s02-cash-desktop.jsonl` |
| Failure screenshots | `reports/screenshots/browser-gameplay-failure-*.png` |

## Expansion Status

| Step | Status | Reason |
|---|---|---|
| A | PASS | 5/5 variants passed cash desktop 10-hand |
| B | FAIL | 100-hand cash desktop found P0/P1 browser gameplay issues |
| C | BLOCKED | Do not run tournament desktop until Step B is fixed |
| D | BLOCKED | Do not run tournament long-run until Step C passes |
| E | BLOCKED | Do not run mobile viewport matrix until desktop passes |
| F | BLOCKED | Do not run live matrix until local matrix passes |

## Next Fix List

1. Add focused repros for S01/S02 late-hand draw/terminal stale hero controls.
2. Preserve partial trace on action-application failure; the harness now writes a halt row before failing.
3. Separate helper action-selection failures from real UI/controller divergence.
4. Re-run Step B only after the focused repros classify and fix the failure.

