# MGX Turn Source of Truth

Last updated: 2026-05-06

This document defines the current actor / turn ownership rule used by the MGX progression tests and the first connected game paths. The goal is to prevent action skip, actor-null freeze, stale metadata turn restoration, and folded/all-in/busted seat turns.

## Field Ownership

| Field | Current Usage | Should Be Authoritative? | Rule | Notes |
| ----- | ------------- | ------------------------ | ---- | ----- |
| `actingPlayerIndex` | Engine/controller actor index | Yes | Primary controller snapshot actor. Non-terminal BET/DRAW states with eligible players must not leave it `null`. | Synced through `normalizeTurnState(...)`. |
| `turn` | UI-compatible actor alias | No | Derived from `actingPlayerIndex`; never independently merged from stale UI state. | Kept for existing UI compatibility. |
| `nextTurn` | Legacy next actor alias | No | Derived from `actingPlayerIndex`; not a separate source of truth. | Existing code may still read it, so it is synchronized. |
| `controllerTurn` | UI/controller bridge field where present | No | May be used by UI display, but should be derived from controller actor. | Not a selector input in the new helper. |
| `metadata.actingPlayerIndex` | Debug / legacy metadata | No | Must not override `currentActor`, `actingPlayerIndex`, `turn`, or `nextTurn`. | Stale metadata is intentionally ignored by `getAuthoritativeActorIndex`. |
| `players[].isTurn` | UI display flag | No | Rebuilt from the authoritative actor; all seats are cleared before setting the actor seat. | Multiple `isTurn` flags are invariant failures. |
| `players[].hasActedThisRound` | Round completion marker | No | Used by eligibility only for the current phase. Betting actions and draw actions are not interchangeable. | `Pat/Draw` no longer count as BET-round completion. |
| `pendingDrawSeats` | Draw actor queue | Yes for DRAW queue | DRAW actor must be inside `pendingDrawSeats` when the queue exists. | Drawn/folded/busted seats are excluded. |
| `lastAggressorIndex` | Betting close helper | No | May inform round completion, but cannot resurrect an ineligible actor. | Existing Badugi close logic still owns aggression semantics. |
| `betHead` | Legacy fixed-limit close helper | No | Fallback close marker only; not an actor source of truth. | Still audited as a remaining cleanup target. |
| `heroActionReadyRef` | UI readiness/display guard | No | Must never decide actor. Display only. | Actor comes from controller snapshot. |

## Actor Logic Consolidation

| Area | Old Source | New Source | Status | Risk | Notes |
| ---- | ---------- | ---------- | ------ | ---- | ----- |
| Core actor eligibility | Scattered checks in Badugi action/bet helpers and tests | `src/games/core/turn/actorEligibility.js` | Added | Medium | Board/Stud paths are not fully rewired yet. |
| Badugi betting next actor | `findNextBetActorSeat` local scan + `lastAction` fallback | `findNextEligibleActor(... phase: "BET")` | Connected | Low | `Pat/Draw` are excluded from BET completion. |
| Badugi draw next actor | Local pending-draw scan | `findNextEligibleActor(... phase: "DRAW", allowAllInDraw: true)` | Connected | Low | Preserves Badugi all-in draw/pat policy explicitly. |
| Badugi snapshot turn flags | Snapshot merge could preserve stale fields | `normalizeTurnState(...)` in controller snapshot build | Connected | Low | Metadata remains debug-only. |
| Draw family legal action/turn display | Controller-local eligibility and UI snapshot flags | Shared betting/drawing eligibility + `normalizeTurnState(...)` | Connected | Medium | D01/D02/S01/S02 smoke/one-hand pass. |
| Invariant actor source | `metadata.actingPlayerIndex` could participate | `getAuthoritativeActorIndex(...)` ignores metadata | Connected | Low | TURN-006 covers stale metadata. |
| UI merge | Existing App/controller merge paths | Partially protected by normalized snapshots and invariants | Partial | Medium | Full App merge audit remains future work. |

## Turn Regression Coverage

| Test ID | Scenario | File | Status | Notes |
| ------- | -------- | ---- | ------ | ----- |
| TURN-001 | SB fold後、BBまたは次eligible seatにturnが渡る | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Shared helper positive path. |
| TURN-002 | BB optionが残る場合、BET roundが終了しない | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Fixed-limit option guard. |
| TURN-003 | folded seatが次actorにならない | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Eligibility helper and invariant. |
| TURN-004 | all-in seatがBET actorにならない | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | BET eligibility excludes all-in. |
| TURN-005 | eligible seatがいるnon-terminal状態でactor nullにならない | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Invariant catches null actor. |
| TURN-006 | stale `metadata.actingPlayerIndex` でも正しいactorを維持 | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Metadata is debug-only. |
| TURN-007 | `players[].isTurn` は最大1人 | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Normalization clears stale flags. |
| TURN-008 | DRAW phaseでは `pendingDrawSeats` 外へturnを回さない | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Draw invariant. |
| TURN-009 | draw済みseatに再度DRAW turnを回さない | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Draw eligibility. |
| TURN-010 | D01/D02/S01/S02 fixed-limit actor pathが壊れない | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Scenario runner across draw family. |

## Remaining Turn Risks

| Risk | Variant/Family | Severity | Next Action |
| ---- | -------------- | -------- | ----------- |
| Board/Stud controllers still have local actor logic | Flop/Omaha/Stud | Medium | Extend `actorEligibility.js` into controller-level selection after current progression tests remain green. |
| Legacy `betHead` / `lastAggressorIndex` semantics are still Badugi-specific | Draw/Badugi | Medium | Isolate close-of-action logic behind a dedicated betting-round helper. |
| UI App state merge can still be complex | All UI paths | Medium | Add a targeted UI merge regression that confirms stale `isTurn` cannot reappear after controller snapshot refresh. |
| Debug logs are noisy during progression tests | Draw/Stud/Board tests | Low | Gate deck/bet debug logging behind an env flag. |

## Verification

| Command | Result | Notes |
|---|---|---|
| `npm run test:game:known-bugs` | PASS | 28 tests passed, including TURN-001 through TURN-010. |
| `npm run test:game:one-hand` | PASS | 53 tests passed; all 36 variants complete one controller/action-path hand. |
| `npm run test:game:progress` | PASS | 137 passed, 11 skipped with explicit reasons. |
| `npm run test:game:family` | PASS | 28 passed. |
| `npm run test:e2e:progress` | PASS | 5 Playwright progress tests passed. |
| `npm test` | PASS | 135 files passed; 957 tests passed, 11 skipped. |
