# MGX Pro Step4-H S02 Hand Class Report

| Hand Class | Rule | Test | Result | Notes |
| ---------- | ---- | ---- | ------ | ----- |
| `premiumSDA5` | `wheel`, `6-low`; pat on draw, `BET` first in, `RAISE` facing bet when cap allows | `PRO-S02-H-001`, `PRO-S02-H-002`, `PRO-S02-H-101`, `PRO-S02-H-102` | PASS | Straight/flush structure is ignored for A-5 single-draw value. |
| `strongSDA5` | clean `7-low`; pat on draw, `BET` first in, `CALL` small/medium pressure, `FOLD` large pressure | `PRO-S02-H-003`, `PRO-S02-H-103`, `PRO-S02-H-104` | PASS | Step4-H treats made `7-low` as stronger than the Step4-G mixed line did. |
| `mediumSDA5` | `8-low`; `CHECK/CALL` only, no raises | `PRO-S02-H-105` | PASS | Small bet defense is allowed, but thin aggression is removed. |
| `weakSDA5` | `9-low`, `T-low`, rough high low; `CHECK/FOLD`, only minimal defense through generic fallback if fold is unavailable | `PRO-S02-H-106` | PASS | Main path no longer spends value trying to defend weak one-draw lows. |
| `trashSDA5` | pair-heavy or busted low; discard pair, never call pressure | `PRO-S02-H-004`, `PRO-S02-H-107` | PASS | Pair handling remains explicit and conservative. |
| draw integrity | completed A-5 lows pat; pair discards; no straight/flush penalty | `PRO-S02-H-005` | PASS | Draw logic is separated from D02 triple-draw heuristics. |
