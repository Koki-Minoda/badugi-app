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
| Current result | 1-hand PASS, 10-hand PASS, 100-hand soak halted |

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
| Badugi cash desktop 100 hands | FAIL/HALT | hand 16 action application stopped after terminal/actor transition inconsistency |

## 100-Hand Halt

The 100-hand run reached hand 16 before stopping. The failure was not the original 1-hand actor/terminal P0 pattern; it halted because the harness believed Hero was the actor and attempted a call, while the browser was already showing a result/terminal-style state. The screenshot also showed stale `ACTING` decoration after `HAND_RESULT`.

Classification:

`REAL_UI_MERGE_BUG` or `TRACE_COLLECTOR_BUG` still needs isolation in long-run soak. The Core5 matrix remains blocked until this is resolved or proven as harness-only by trace.

## Release Impact

The minimal 1-hand P0 is fixed locally and monitored. The browser gameplay release gate remains `FAIL` because 100-hand Badugi cash desktop does not yet pass, and matrix expansion is intentionally blocked.
