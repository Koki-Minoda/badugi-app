# Known Bugs (snapshot)

| Bug ID | Title | Status | Notes |
| --- | --- | --- | --- |
| Bug-01 | Negative stack after all-in | DONE | `isBusted` + blind clamp landed |
| Bug-02 | Bet round never ends with multiple all-ins | DONE | `hasActedThisRound` + improved `isBetRoundComplete` |
| Bug-03 | Wrong DRAW start seat | DONE | Uses `calcDrawStartIndex` |
| Bug-04 | Ambiguous BET termination | DONE | `lastAggressor` + closing-seat logic landed |
| Bug-05 | UI vs evaluator mismatch | DONE | UI logs & NPC draws now read `{ rankType, ranks, kicker }` |
| Bug-06 | CPU stack/bet visibility | DONE | New `PlayerStatusBoard` HUD lists every stack/bet/status |
| Bug-07 | Seats break on resize | DONE | Responsive grid + absolute layout landed (`ui/App.jsx`, `Player.jsx`) |
| Bug-08 | Hand history misses intermediate actions | DONE | RecordAction now logs every BET/DRAW/SHOWDOWN step with stack/bet snapshots |

## TODO
- Finalize `recordActionToLog` / JSONL schema (stackAfter, drawInfo, etc.).
- Rebuild the table layout (Grid/Flex) so the new Player cards stay responsive.
- Replace legacy history exports with the JSONL flow once Bug-08 is complete.
