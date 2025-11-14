# Known Bugs (Snapshot)

| Bug ID | Title / Summary | Status | Notes |
| --- | --- | --- | --- |
| Bug-01 | Negative stack after all-in | ✅ Fixed | `isBusted` + blind clamp landed |
| Bug-02 | Bet round never ends with multiple all-ins | ✅ Fixed | `hasActedThisRound` + improved `isBetRoundComplete` |
| Bug-03 | Wrong DRAW start seat | ✅ Fixed | Uses `calcDrawStartIndex` |
| Bug-04 | Ambiguous BET termination | ✅ Fixed | `lastAggressor` + closing-seat logic landed |
| Bug-05 | UI vs evaluator mismatch | 🟡 In progress | Evaluator unified; UI still uses `score` |
| Bug-06 | CPU stack/bet visibility | 🟡 In progress | Player card updated; table layout pending |
| Bug-07 | Seats break on resize | ⛔ Not started | Requires Grid/Flex layout |
| Bug-08 | Hand history misses intermediate actions | 🟡 In progress | DRAW logs ready; format unification outstanding |

## TODO
- Finalize `recordActionToLog` / JSONL schema (stackAfter, drawInfo, etc.).  
- Rebuild the table layout (Grid/Flex) so the new Player cards stay responsive.  
- Replace every `evaluateBadugi(...).score` usage with the canonical `{ rankType, ranks }` data.
