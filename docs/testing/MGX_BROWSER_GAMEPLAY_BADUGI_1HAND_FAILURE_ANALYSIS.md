# MGX Browser Gameplay Badugi 1-Hand Failure Analysis

Date: 2026-05-17

## Scope

| Field | Value |
|---|---|
| Variant | Badugi |
| Mode | Cash |
| Viewport | Desktop 1280x720 |
| Initial run | 1 hand / 31 actions |
| Initial result | FAIL |
| Current result | 1-hand PASS, 10-hand PASS, 100-hand PASS, Badugi-only mode/viewport matrix PASS with P1 pot monitor |

## Initial Failure Summary

| Type | Count | Severity | Classification |
|---|---:|---|---|
| ACTOR | 2 | P0 | TRACE_COLLECTOR_BUG / TRANSIENT_LAG_NEEDS_GRACE_WINDOW |
| TERMINAL | 2 | P0 | TRACE_COLLECTOR_BUG |
| POT | 1 | P1 | TRANSIENT_LAG_NEEDS_GRACE_WINDOW |
| PHASE | 2 | P1 | TRANSIENT_LAG_NEEDS_GRACE_WINDOW |

## ACTOR P0 Analysis

The initial actor failures appeared in snapshots captured immediately after browser actions and phase transitions. The trace showed expected/controller actor mismatches, but the failure screenshots and later settled snapshots did not show a user-clickable illegal action state.

Root cause:

- The collector sampled state during UI/controller transition windows.
- The expected actor calculator treated current-bet-matched players as resolved even when they had not yet acted this street.
- Hidden or stale action-button DOM could be counted as visible controls.

Classification:

`TRACE_COLLECTOR_BUG` and `TEST_ASSERTION_TOO_STRICT`, with bounded transition grace needed. No stable 1-hand engine actor-order bug remains after the fix.

## TERMINAL P0 Analysis

Terminal failures came from controller snapshot collection after hand result. `phaseState.turn` was explicitly `null`, but the collector fell back to stale `controllerSnapshot.turn` / `state.turn`, causing terminal rows to appear actor-active.

Root cause:

`collectBrowserGameplaySnapshot` did not preserve explicit `null` actor state.

Classification:

`TRACE_COLLECTOR_BUG`.

## POT / PHASE P1 Analysis

Pot and phase mismatches occurred at action boundaries and DRAW/BET transitions. The displayed phase could lag controller phase for a short render interval, and displayed pot/controller pot could briefly diverge while the UI settled.

Classification:

`TRANSIENT_LAG_NEEDS_GRACE_WINDOW`.

The harness now retries boundedly before recording these as stable violations. Active-hand pot zero remains disallowed.

## Fixes Applied

| Area | Change |
|---|---|
| Snapshot collector | Explicit `phaseState.turn: null` now clears actor instead of falling back to stale turn metadata. |
| Action visibility | Browser action controls are counted only when visible, enabled, in viewport, and topmost/interactable. |
| Expected actor | A player who has not acted this street remains pending even when their contribution already matches `currentBet`. |
| Harness grace | Invariant collection retries before recording transition-window violations. |
| UI turn source | Single-table controller-driven games prefer live controller/legacy turn over stale session turn for hero controls. |

## Re-run Results

| Gate | Result | Evidence |
|---|---|---|
| Badugi cash desktop 1 hand | PASS | `tests/e2e/browser-gameplay-invariant-harness.spec.ts` |
| Badugi cash desktop 10 hands | PASS | `tests/e2e/browser-gameplay-invariant-harness.spec.ts` |
| Badugi cash desktop 100 hands | PASS | no halt, no P0 actor/terminal/action-reopen violations |
| Badugi cash/tournament desktop/portrait/landscape 20 hands each | PASS_WITH_P1_MONITOR | 120 hands completed; 14 P1 pot-display/controller timing rows in cash only |

## Hand16 Halt Diagnosis

The original 100-hand run reached hand 16 before stopping. The focused repro test now runs the same Badugi cash desktop path through hand20 and writes a per-loop progress-helper decision log.

| Artifact | Path |
|---|---|
| Focused trace | `reports/browser-gameplay/badugi-cash-desktop-hand16-halt-trace.jsonl` |
| Focused summary | `reports/browser-gameplay/badugi-cash-desktop-hand16-halt-summary.json` |
| Progress helper decision log | `reports/browser-gameplay/progress-helper-hand16-decision-log.jsonl` |
| Halt screenshot | none after fix; focused repro did not halt |

Focused result:

- `handsCompleted=20`
- `actionsObserved=424`
- `halt=null`

The halt was not reproduced after improving terminal/next-hand detection and progress-helper re-query behavior. The earlier halt classifies as helper stale-read/terminal misclassification, not a confirmed game freeze.

Classification:

`PROGRESS_HELPER_STALE_READ`, `PROGRESS_HELPER_MISCLASSIFIED_TERMINAL`, and `NEXT_HAND_BUTTON_DETECTION_BUG`.

## Remaining P1 Pot Monitor

The Badugi-only mode/viewport matrix completed 120/120 hands and produced no P0 actor, terminal, action-reopen, active-pot-zero, or freeze violations. It did record 14 P1 pot display/controller rows in cash views. These rows occur at action boundaries where UI `Total Pot` includes the just-applied contribution before the controller `pot` field has settled to the same displayed value. Active-hand pot zero did not occur.

Classification:

`TRANSIENT_LAG_NEEDS_GRACE_WINDOW / MONITOR`.

## Release Impact

The minimal 1-hand P0 and the 100-hand hand16 halt are fixed locally and monitored. Badugi browser gameplay can now advance to the next ladder step. Core5 full matrix expansion is still a separate gate and should not be treated as complete from this Badugi-only result.
