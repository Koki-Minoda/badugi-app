# MGX Pro Step4-O D01 Hand Class Report

| Hand Class | Rule Change | Test | Result | Notes |
| ---------- | ----------- | ---- | ------ | ----- |
| `premium27TD` | Keep `clean 7-low` and upper `smooth 8-low` on value rails; allow selected final raise when legal. | `PRO-D01-O-101`, `PRO-D01-O-102`, `PRO-D01-O-103`, `PRO-D01-O-204` | PASS | Step4-O keeps strong value realization while late defense is reduced elsewhere. |
| `strong27TD` upper | `rough 8-low` may call only small pressure and selected medium pressure; fold large pressure. | `PRO-D01-O-001`, `PRO-D01-O-002`, `PRO-D01-O-104` | PASS | This is the main thin-defense bucket preserved after the D01 trim. |
| `medium27TD` upper | `upper rough 9-low` may tiny-call only the smallest pressure. | `PRO-D01-O-003` | PASS | The old broad `playable-low-call` path is no longer used for this bucket. |
| `medium27TD` lower | `T-low` and lower `rough 9-low` are now `CHECK/FOLD` / `FOLD` under pressure. | `PRO-D01-O-004` | PASS | This removes late `CALL losing call` volume without touching strong made lows. |
| `trash27TD` | pair / straight / flush / penalty-heavy hands fold under pressure and never value-bet. | `PRO-D01-O-005`, `PRO-D01-O-201`, `PRO-D01-O-202` | PASS | This is the biggest fallback reduction source for D01. |
| draw regression | pair discards, penalty-break draws, high-card discards, and `A`-high treatment are unchanged. | `PRO-D01-O-201`, `PRO-D01-O-202`, `PRO-D01-O-203`, `PRO-D01-O-205` | PASS | Step4-O did not break the existing triple-draw discard rails. |
