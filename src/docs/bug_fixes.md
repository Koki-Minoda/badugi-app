# Bug Fixes / Progress Log

> Legend: DONE / IN_PROGRESS / NOT_STARTED

## Bug-01 - Negative stacks after all-in
- Status: DONE
- Notes: SB/BB payments are clamped, `isBusted` flag added (`ui/App.jsx`, `roundFlow.js`, `showdown.js`).

## Bug-02 - Bet round never finishes when multiple players are all-in
- Status: DONE
- Changes:
  - `ui/App.jsx`: introduced `hasActedThisRound` state for every player, set/reset across fold/call/raise/NPC actions, and short-circuited BET flow using the new `isBetRoundComplete` result.
  - `games/badugi/logic/roundFlow.js`: `isBetRoundComplete` now checks both matched bet sizes and `hasActedThisRound` (or all-in).
  - `games/badugi/logic/drawRound.js`: optional `onActionLog` callback keeps the history in sync with the revised BET flow.

## Bug-03 - Wrong DRAW start seat
- Status: DONE (`calcDrawStartIndex`).

## Bug-04 - Ambiguous BET termination
- Status: DONE
- Fix: Added `lastAggressor` + `closingSeatForAggressor` and combined them with `hasActedThisRound` so the street closes exactly when action returns to the aggressor.

## Bug-05 - UI vs evaluator mismatch
- Status: DONE
- Fix: Removed every `ev.score` usage. `ui/App.jsx` now logs showdown hands with `{ rankType, ranks }` and NPC draws route through the new `npcAutoDrawCount()` helper that reads `kicker`. CPU draw heuristics no longer rely on the removed `score` field.

## Bug-06 - CPU stack/bet hard to read
- Status: IN_PROGRESS (player card refresh is live; table layout update pending).

## Bug-07 - Seats break on resize
- Status: NOT_STARTED (Grid/Flex rewrite queued).

## Bug-08 - Hand history misses intermediate actions
- Status: IN_PROGRESS (DRAW actions log correctly; JSONL unification remains).

---

## Changed Files / Status
| File | Summary | Status |
| --- | --- | --- |
| `ui/App.jsx` | Bust handling (Bug-01) + BET flow (`hasActedThisRound`, forced round completion) + Bug-05 evaluator sync | DONE |
| `gameLogic/betRound.js` | Legacy NPC logic updated to new evaluator | DONE |
| `games/badugi/logic/drawRound.js` | Added `onActionLog` hook | IN_PROGRESS (callers still being wired) |
| `games/badugi/logic/roundFlow.js` | BET/DRAW orchestration, `calcDrawStartIndex`, improved `isBetRoundComplete` | IN_PROGRESS |
| `games/badugi/logic/showdown.js` | Logs + bust flag refresh | DONE |
| `games/badugi/utils/badugiEvaluator.js` | Canonical Badugi evaluator | DONE |
| `games/badugi/utils/handRankings.js` | Default return format updated | DONE |
| `ui/components/Player.jsx` | Player panel redesign | IN_PROGRESS |
| `utils/badugi.js` | Legacy wrapper -> canonical evaluator | DONE |
| `utils/history_rl.js` | JSONL append/save/export | IN_PROGRESS |

---

## Pending / Follow-up Tasks
1. Extend `recordActionToLog` + JSONL schema to preserve `stackAfter` and DRAW metadata.
2. Finish wiring `onActionLog` (Bug-08) everywhere BET/DRAW/SHOWDOWN transitions happen.
3. Rebuild the table UI (Grid/Flex) so the new Player cards survive resize (Bug-06/07).


