# MGX Pro Step4-I S01 Hand Class Report

| Hand Class | Rule | Test | Result | Notes |
| ---------- | ---- | ---- | ------ | ----- |
| `premiumSD27` | clean `7-low`, smooth `8-low`; pat on draw, `BET` first in, `RAISE` facing bet when cap allows | `PRO-S01-I-001`, `PRO-S01-I-002`, `PRO-S01-I-101`, `PRO-S01-I-102` | PASS | Single-draw 2-7 now treats clean completions as more valuable than the generic prior line. |
| `strongSD27` | rough `8-low`, smooth `9-low`; `BET` first in, `CALL` small/medium pressure, `FOLD` large pressure | `PRO-S01-I-103` | PASS | This class is intentionally value-oriented but still more cautious than `premiumSD27`. |
| `mediumSD27` | rough `9-low`, `T-low` without penalty; `CHECK/CALL`, no raises | `PRO-S01-I-104` | PASS | Small-bet defense is allowed, but thin aggression is blocked. |
| `weakSD27` | `J-low` and rough high lows; `CHECK/FOLD`, only minimal small-bet defense through fallback if no fold exists | `PRO-S01-I-105` | PASS | The new class sharply cuts weak end-of-hand defense. |
| `trashSD27` | pair, straight, flush, pair-heavy, penalty-heavy; `CHECK/FOLD`, no calls | `PRO-S01-I-003`, `PRO-S01-I-004`, `PRO-S01-I-106`, `PRO-S01-I-107` | PASS | Pair / straight / flush penalties now stay out of the value line. |
| draw integrity | ace remains high, pair breaks, clean `7-low`/smooth `8-low` pat | `PRO-S01-I-005` | PASS | S01 remains separate from the A-5 single-draw logic added for S02. |
