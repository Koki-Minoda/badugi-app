# MGX Pro Step4-K S01 Value/Defense Report

| Rule | Test | Result | Notes |
| ---- | ---- | ------ | ----- |
| `strongSD27` upper keeps first-in value | `PRO-S01-K-001` | PASS | Rough `8-low` upper stays in the open `BET` line. |
| `strongSD27` upper can thin-raise small pressure | `PRO-S01-K-002` | PASS | Thin raising is limited to the strongest rough `8-low` small-pressure spots. |
| `strongSD27` upper folds large pressure | `PRO-S01-K-003` | PASS | The new value line does not reopen large-pressure defense. |
| rough `9-low` is not promoted into upper `strongSD27` | `PRO-S01-K-004` | PASS | `9-low` remains outside the new strong-value branch. |
| upper rough `9-low` may call small bets | `PRO-S01-K-101` | PASS | Only the upper branch keeps small-bet defense. |
| upper rough `9-low` folds medium / large bets | `PRO-S01-K-102` | PASS | Medium and large pressure are still cut. |
| lower rough `9-low` folds facing bets | `PRO-S01-K-103` | PASS | The lower branch is now effectively `CHECK/FOLD`. |
| rough `9-low` never raises | `PRO-S01-K-104` | PASS | No thin aggression was added to the rough `9-low` branch. |
| `T-low` stays `CHECK/FOLD` | `PRO-S01-K-105` | PASS | Bottom-edge medium defense remains suppressed. |
| pair / straight / flush / ace-high regression stays blocked | `PRO-S01-K-201` to `PRO-S01-K-204` | PASS | Penalty logic remains isolated to `S01` and does not leak back into `S02`. |

