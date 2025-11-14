# Bug Fixes / Progress Log

> Legend: ✅ Done / 🟡 In progress / ⛔ Not started

## Bug-01 — Negative stacks after all-in
- **Status**: ✅  
- **Notes**: SB/BB payments are clamped, `isBusted` flag added (`ui/App.jsx`, `roundFlow.js`, `showdown.js`).

## Bug-02 — Bet round never finishes when multiple players are all-in
- **Status**: ✅  
- **What changed**  
  - `ui/App.jsx`: introduced `hasActedThisRound` state for every player, set/reset across fold/call/raise/NPC actions, and short-circuited BET flow using the new `isBetRoundComplete` result.  
  - `games/badugi/logic/roundFlow.js`: `isBetRoundComplete` now checks both “matched bet size” and “has acted (or all-in)”.  
  - `games/badugi/logic/drawRound.js`: optional `onActionLog` callback wired in (keeps action log in sync with the new BET flow).  
- **Follow-up**: Bug-04 still plans to add `lastAggressor`, but Bug-02’s acceptance condition is satisfied.

## Bug-03 — Wrong DRAW start seat
- **Status**: ✅ (`calcDrawStartIndex`).

## Bug-04 — Ambiguous BET termination
- **Status**: ✅  
- **Fix**: `lastAggressor` を state 化。BET ラウンド開始時／強制ブラインド／Raise ごとに更新し、`closingSeatForAggressor`（新規ヘルパ）と `hasActedThisRound` を組み合わせて「レイザーに戻るまで」を正しく判定するようにした。

## Bug-05 — UI vs evaluator mismatch
- **Status**: 🟡 — canonical evaluator is done (`games/badugi/utils/badugiEvaluator.js` / `utils/badugi.js`), UI still reads `ev.score`.

## Bug-06 — CPU stack/bet hard to read
- **Status**: 🟡 — player card component refreshed, table layout pending.

## Bug-07 — Seats break on resize
- **Status**: ⛔ — waiting for table layout rewrite.

## Bug-08 — Hand history misses intermediate actions
- **Status**: 🟡 — DRAW actions can now be logged; action format unification remains.

---

## Changed Files / Status
| File | Summary | Status |
| --- | --- | --- |
| `ui/App.jsx` | Bust handling (Bug-01) + BET flow (`hasActedThisRound`, forced round completion) | ✅ |
| `gameLogic/betRound.js` | Legacy NPC logic updated to new evaluator | ✅ |
| `games/badugi/logic/drawRound.js` | Added `onActionLog` hook | 🟡 (caller wiring ongoing) |
| `games/badugi/logic/roundFlow.js` | BET/DRAW orchestration, `calcDrawStartIndex`, improved `isBetRoundComplete` | 🟡 |
| `games/badugi/logic/showdown.js` | Logs + bust flag refresh | ✅ |
| `games/badugi/utils/badugiEvaluator.js` | Canonical Badugi evaluator | ✅ |
| `games/badugi/utils/handRankings.js` | Default return format updated | ✅ |
| `ui/components/Player.jsx` | Player panel redesign | 🟡 |
| `utils/badugi.js` | Legacy wrapper -> canonical evaluator | ✅ |
| `utils/history_rl.js` | JSONL append/save/export | 🟡 |

---

## Pending / Follow-up Tasks
1. Extend `recordActionToLog` + JSONL schema to preserve `stackAfter` / DRAW info.
2. Implement `lastAggressor` handling (Bug-04) now that `hasActedThisRound` exists.
3. Rebuild the table UI (Grid/Flex) so the new Player cards survive resize (Bug-06/07).
4. Replace every `evaluateBadugi(...).score` usage in UI/logs with `rankType` / `ranks`.
