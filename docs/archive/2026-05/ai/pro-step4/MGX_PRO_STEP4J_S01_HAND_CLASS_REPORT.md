# MGX Pro Step4-J S01 Hand Class Report

| Hand Class | Rule Change | Test | Result | Notes |
| ---------- | ----------- | ---- | ------ | ----- |
| `premiumSD27` | unchanged from Step4-I; clean `7-low` and smooth `8-low` still `BET/RAISE` first in | `PRO-S01-I-001`, `PRO-S01-I-002`, `PRO-S01-I-101`, `PRO-S01-I-102` | PASS | Step4-J keeps the premium line intact and does not re-open passive checkback defaults. |
| `strongSD27` | rough `8-low` and non-rough `9-low` stay in the value line; `BET` first in, `CALL` small and selected medium bets, `FOLD` large pressure | `PRO-S01-J-001`, `PRO-S01-J-002`, `PRO-S01-J-003`, `PRO-S01-J-004` | PASS | This is the main Step4-J thin-value upgrade. |
| `mediumSD27` | rough `9-low` calls only small bets; `T-low` shifts to `CHECK/FOLD`; no raises | `PRO-S01-J-101`, `PRO-S01-J-102`, `PRO-S01-J-103`, `PRO-S01-J-104` | PASS | Step4-J cuts the bottom-edge small-bet defense that was still leaking EV. |
| penalty hands | pair / straight / flush stay outside the value line and avoid final calls | `PRO-S01-J-201`, `PRO-S01-J-202`, `PRO-S01-J-203`, `PRO-S01-J-204` | PASS | `S01` remains cleanly separate from the A-5 single-draw logic used by `S02`. |

