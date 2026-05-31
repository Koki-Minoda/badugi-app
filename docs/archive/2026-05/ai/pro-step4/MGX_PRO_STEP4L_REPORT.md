# MGX Pro Step4-L Report

Seeds: `20260506`, `20260507`, `20260508`  
Focused S01/S02 run: `300` hands per seed  
Full-suite run: `100` hands per variant per seed

| Variant | Step4K Pro EV | Step4L Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -3.0 | -3.0 | 33.0 | -36.0 | 0.1311 | PASS | IMPROVED_NOT_READY |
| D02 | 9.2 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -0.3 | -0.3 | 30.3 | -30.5 | 0.2631 | PASS | IMPROVED_NOT_READY |
| S02 | -5.4 | -6.3 | 36.3 | -42.7 | 0.2583 | PASS | REGRESSED |

## Notes

- Step4-L is intentionally isolated to `S02` and keeps frequency out of the main decision path.
- `premiumSDA5` / `strongSDA5` thin value and `upperMediumSDA5` / `lowerMediumSDA5` separation improve the focused `S02` run, but the refreshed full-suite `100`-hand average still regresses.
- `S01`, `D01`, `D02`, and `D03` remain effectively unchanged, which means the isolation boundary held.

## Focused Single-Draw Check

| Variant | Focused Run | Avg Pro EV | Avg Standard EV | Gap | Fallback | Illegal |
| ------- | ----------: | ---------: | --------------: | --: | -------: | ------: |
| S01 | 300 hands x 3 seeds | -1.1 | 31.1 | -32.1 | 0.2594 | 0.0000 |
| S02 | 300 hands x 3 seeds | -4.6 | 34.6 | -39.2 | 0.2549 | 0.0000 |

## Verdict

`IMPROVED_BUT_NOT_READY` for the focused `S02` target, but `REGRESSED` on the required full-suite average.

Step4-L proves the new S02 hand-class split can create local EV gains without harming safety, but it does not yet clear the Step4-K full-suite baseline.
