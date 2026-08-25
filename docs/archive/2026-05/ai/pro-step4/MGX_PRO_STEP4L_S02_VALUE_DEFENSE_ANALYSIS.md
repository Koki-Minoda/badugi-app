# MGX Pro Step4-L S02 Value/Defense Analysis

Target variant: `S02 A-5 Single Draw`  
Comparison baseline: Step4-K focused `300`-hand runs vs Step4-L focused `300`-hand runs

## Leak Summary

| Hand Class | Leak Type | Count | EV Impact | Facing Action | Pro Action | Standard Action | Suggested Fix |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| `premiumSDA5` | missed value | medium | medium positive | first in | `BET` more often in Step4-L | `BET` | Keep deterministic `BET` first-in and allow small/medium value raises only when `RAISE` is legal. |
| `strongSDA5` | under-bet | medium | medium positive | first in / small bet | `BET` first in, `CALL` small/medium | mixed value line | Preserve the S02-only value line and avoid collapsing `7-low` back into passive `CHECK`. |
| `upperMediumSDA5` | under-realization | low-medium | low positive | first in / small bet | `BET` thinly first in, `CALL` only small bets | more mixed | Keep `smooth 8-low` as the only medium branch with thin value. |
| `lowerMediumSDA5` | over-call / over-defense | medium | high positive when removed | medium / large bet | `FOLD` | mixed continue | Keep `rough 8-low` out of medium/large continues. |
| `weakSDA5` | `9-low` over-defense | medium | medium positive when removed | any bet | `FOLD` | occasional calls | Do not reopen weak `9-low/T-low` defense. |
| `trashSDA5` | pair-heavy leak | low | low positive when removed | any bet | `FOLD` | fold-heavy | Pair-heavy / busted A-5 hands remain hard `CHECK/FOLD`. |

## Focused Metric Delta

| Metric | Step4-K Focused Avg | Step4-L Focused Avg | Direction |
| --- | ---: | ---: | --- |
| Pro EV | `-7.0` | `-4.6` | Improved |
| Standard EV | `37.0` | `34.6` | Lower benchmark in sampled run |
| EV Gap | `-44.0` | `-39.2` | Improved |
| Fallback | `0.2548` | `0.2549` | Flat |
| Value Bet Frequency | `0.0065` | `0.0099` | Higher |
| Check Back Frequency | `0.2402` | `0.2339` | Lower |
| Call Facing Bet Frequency | `0.2653` | `0.2663` | Flat |
| Fold Facing Bet Frequency | `0.1852` | `0.1887` | Slightly higher |

## Reading

- Step4-L succeeds locally: `premiumSDA5`/`strongSDA5` and the top of `mediumSDA5` realize more value in the focused `S02` runs.
- The gains come from lower `CHECK` frequency and a slightly higher deterministic value-bet rate, not from frequency control.
- Weak and trash A-5 defense did not reopen, which keeps the safety/fallback profile intact.
- The full-suite `100`-hand average still regresses relative to Step4-K, so the remaining problem is not basic safety; it is cross-sample EV stability.

## Suggested Next Fix

1. Keep the new `upperMediumSDA5` / `lowerMediumSDA5` split.
2. Leave `weakSDA5` / `trashSDA5` as hard `CHECK/FOLD`.
3. If S02 needs another pass, target only the top of `strongSDA5` and the weakest `upperMediumSDA5` open-value spots rather than re-adding defense.
