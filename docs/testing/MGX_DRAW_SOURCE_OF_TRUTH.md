# MGX Draw Source of Truth

Last updated: 2026-05-06

This document fixes the current source-of-truth rules for MGX draw phases. The goal is to prevent draw-round rollback, hand rollback, stale snapshot overwrites, invalid discard actions, and CPU draw stalls across Badugi and the Draw family (`D01`, `D02`, `S01`, `S02`).

## Field Rules

| Field | Current Usage | Should Be Authoritative? | Rule | Notes |
|---|---|---:|---|---|
| `drawRound` | UI/debug compatibility field | No | Derived from `drawRoundIndex` when both exist | Do not use a stale `drawRound` to move controller state backward. |
| `drawRoundIndex` | Engine/controller round index | Yes | Engine/controller value is authoritative and must not decrease within one hand | Scenario runner records visited indexes for regression detection. |
| `maxDrawRounds` | Variant/controller config | Yes | Badugi/D01/D02 = 3; S01/S02 = 1; bounded by variant config | Invariants reject `drawRoundIndex > maxDrawRounds`. |
| `pendingDrawSeats` | Draw actor queue | Yes when present | DRAW actor must be in this queue; completed seats are removed | Folded/busted/sitting-out seats must not remain pending. |
| `players[].hand` | Current cards | Yes in engine/controller | Snapshot/UI local state must not overwrite newer controller hand state | Draw action records `beforeHand` and `afterHand`. |
| `players[].selected` | UI selected cards | No | UI-only transient selection | Must be converted to `discardIndexes` before controller action. |
| `players[].hasDrawn` | Compatibility draw flag | No | Compatibility only; pending queue and round action flags are stronger | Used by invariants to reject already-drawn pending seats. |
| `players[].hasActedThisRound` | Round completion marker | Yes within current round | True after draw/pat or betting action for the active round | Reset only at street/round boundary. |
| `players[].lastDrawCount` | Display/history helper | No | Derived from normalized `discardIndexes.length` | Kept for UI/history compatibility. |
| `discardIndexes` | Draw card identity | Yes | Primary draw input when present; sorted, unique, in range | `[]` means pat. |
| `drawCount` | Count-only draw request | No | Derived from `discardIndexes.length`; accepted only as compatibility input | Count-only actions are normalized to deterministic indexes before engine mutation. |
| `discarded` | History/replay payload | No | Derived from `beforeHand` and `discardIndexes` | Persisted in metadata/logs. |
| `drawn` | History/replay payload | No | Replacement cards drawn from deck | Persisted in metadata/logs. |
| `keptCards` | History/replay payload | No | Derived from `beforeHand` minus discarded cards | Persisted for replay/debug. |
| `replacedCards` | Compatibility field | No | Alias of `drawn` when present | Prefer `drawn` in new code. |
| `beforeHand` | Draw audit payload | No | Snapshot of hand immediately before normalized draw application | Used to detect rollback and replay corruption. |
| `afterHand` | Draw audit payload | Yes for post-action state | Must match `players[seat].hand` after draw | Invariants compare shape and hand size. |
| `metadata.drawRoundIndex` | Debug metadata | No | Debug only, never source of truth | Must not override controller `drawRoundIndex`. |
| `snapshot.players` | UI/controller boundary | No for mutation | Display payload only after controller snapshot generation | UI merge must not resurrect older hands. |
| UI local `players` | React display state | No | Derived view state | Must not push old hand/draw round back into controller. |

## Draw Action Rules

| Area | Rule | Status |
|---|---|---|
| Primary identity | `discardIndexes` is authoritative when supplied | Implemented |
| Count fallback | `drawCount` is accepted only when indexes are absent, then deterministically converted to indexes | Implemented |
| Pat | `discardIndexes: []` or `drawCount: 0` means stand pat | Implemented |
| Badugi max discard | Maximum 4 cards | Implemented |
| 5-card draw max discard | Maximum 5 cards for D01/D02/S01/S02 | Implemented |
| Single draw | S01/S02 cannot visit more than one draw round | Regression-tested |
| Invalid indexes | Duplicate or out-of-range indexes are invalid | Regression-tested |
| Mismatch | If `drawCount` conflicts with `discardIndexes`, indexes win and warning metadata is emitted | Implemented |
| CPU/replay/RL input | Count-only compatibility input is normalized before engine mutation | Implemented |

## Draw Source Consolidation

| Area | Old Source | New Source | Status | Risk | Notes |
|---|---|---|---|---|---|
| Discard identity | Mixed `drawCount`, UI selected cards, controller payload | `normalizeDiscardIndexes(...)` | Added | Low | Duplicate/out-of-range indexes throw. |
| Draw action payload | Per-engine local normalization | `normalizeDrawAction(...)` | Added | Low | Badugi and D01/D02/S01/S02 use shared normalization. |
| Draw validation | Ad hoc checks | `validateDrawAction(...)` plus invariants | Added | Medium | Validation helper is available; not all controllers call it directly yet. |
| Badugi draw metadata | Partial count/action labels | `beforeHand`, `afterHand`, `discardIndexes`, `discarded`, `drawn`, `keptCards` | Added | Low | Controller and legacy draw round both record draw audit data. |
| Draw family metadata | Local discard action | Normalized metadata `lastDrawAction` | Added | Low | D01/D02/S01/S02 preserve draw info for replay/RL. |
| Draw round monotonicity | Not enforced globally | Invariant compares previous snapshot and current snapshot | Added | Medium | Depends on scenario/E2E providing prior snapshot. |
| Pending queue integrity | Partially checked | Invariant rejects inactive/already-drawn pending seats | Added | Low | Covers folded/busted/sitting-out seats. |
| UI stale snapshot | React merge risk | Documented SOT and metadata coverage | Partial | Medium | A targeted UI stale-hand E2E remains useful. |

## Draw Regression Coverage

| Test ID | Scenario | File | Status | Notes |
|---|---|---|---|---|
| DRAW-SOT-001 | Draw afterHand is preserved in controller snapshot/metadata | `src/games/testing/regression/gameProgressKnownBugs.test.js` | PASS | Badugi controller path. |
| DRAW-SOT-002 | `drawRoundIndex` does not roll backward in D01/D02/S01/S02 scenarios | `gameProgressKnownBugs.test.js` | PASS | Scenario runner returns visited draw indexes. |
| DRAW-SOT-003 | `discardIndexes` wins over conflicting `drawCount` | `gameProgressKnownBugs.test.js` | PASS | Warning metadata is retained. |
| DRAW-SOT-004 | Duplicate `discardIndexes` are invalid | `gameProgressKnownBugs.test.js` | PASS | Shared helper throws. |
| DRAW-SOT-005 | Out-of-range `discardIndexes` are invalid | `gameProgressKnownBugs.test.js` | PASS | Shared helper throws. |
| DRAW-SOT-006 | Pat is represented as `discardIndexes=[]` | `gameProgressKnownBugs.test.js` | PASS | Count and indexes normalize to zero discard. |
| DRAW-SOT-007 | Badugi cannot discard more than 4 cards | `gameProgressKnownBugs.test.js` | PASS | Shared helper max discard guard. |
| DRAW-SOT-008 | D01/D02/S01/S02 can normalize up to 5 cards | `gameProgressKnownBugs.test.js` | PASS | 5-card draw family path. |
| DRAW-SOT-009 | S01/S02 visit only one draw round | `gameProgressKnownBugs.test.js` | PASS | Unique draw indexes asserted. |
| DRAW-SOT-010 | CPU draw clears pending draw state | `gameProgressKnownBugs.test.js` | PASS | D02 scenario. |
| DRAW-SOT-011 | Drawn seat is removed from pending queue | `gameProgressKnownBugs.test.js` | PASS | Negative pending queue fixture. |
| DRAW-SOT-012 | Previous higher draw round rejects stale lower snapshot | `gameProgressKnownBugs.test.js` | PASS | Invariant rollback guard. |
| DRAW-SOT-013 | Hand history/action metadata retains draw info | `gameProgressKnownBugs.test.js` | PASS | D01 `lastDrawAction` audit payload. |
| DRAW-SOT-014 | RL/replay count-only draw action is normalized | `gameProgressKnownBugs.test.js` | PASS | D01 controller count-only payload. |

## Verification

| Command | Result | Notes |
|---|---|---|
| `npm run test:game:known-bugs` | PASS | 42 tests passed after DRAW-SOT-001 through DRAW-SOT-014. |
| `npm run test:game:one-hand` | PASS | 53 tests passed; all 36 variants complete one controller-path hand. |
| `npm run test:game:progress` | PASS | 151 tests passed, 11 skipped with explicit reasons. |
| `npm run test:game:family` | PASS | 28 tests passed. |

## Remaining Draw Risks

| Risk | Variant/Family | Severity | Next Action |
|---|---|---|---|
| UI stale hand merge can still regress outside controller-level tests | Badugi / Draw UI | Medium | Add UI-click E2E that draws on Draw#1 and Draw#2, then asserts card identity never reverts. |
| Dramaha board+draw UI result clarity is separate from generic draw normalization | Dramaha / split draw | Medium | Add component-pot/odd-chip UI E2E with draw metadata assertions. |
| Validation helper is not yet the sole entry point for every historical draw path | Legacy/UI helpers | Medium | Gradually replace remaining direct draw payload handling with `normalizeDrawAction(...)`. |
| Heavy deck debug output makes draw failures noisy | All tests | Low | Gate `[DECK][STATE]` logging behind an env flag. |
