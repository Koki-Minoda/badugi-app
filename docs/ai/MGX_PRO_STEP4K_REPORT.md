# MGX Pro Step4-K Report

Seeds: `20260506`, `20260507`, `20260508`  
Focused S01/S02 run: `300` hands per seed  
Full-suite run: `100` hands per variant per seed

| Variant | Step4J Pro EV | Step4K Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -3.0 | -3.0 | 33.0 | -36.0 | 0.1311 | PASS | IMPROVED_NOT_READY |
| D02 | 9.2 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -5.3 | -0.3 | 30.3 | -30.5 | 0.2631 | PASS | IMPROVED_NOT_READY |
| S02 | -5.4 | -5.4 | 35.4 | -40.8 | 0.2582 | PASS | IMPROVED_NOT_READY |

## Notes

- Step4-K keeps the Step4-J `S01` hand-class split and only adds `strongSD27` upper thin value plus upper/lower rough `9-low` branching.
- `S01` improves on both the full 3-seed suite and the focused `300`-hand runs.
- `S02`, `D01`, `D02`, and `D03` remain effectively unchanged, which is the intended isolation boundary for this step.

## Focused Single-Draw Check

| Variant | Focused Run | Avg Pro EV | Avg Standard EV | Gap | Fallback | Illegal |
| ------- | ----------: | ---------: | --------------: | --: | -------: | ------: |
| S01 | 300 hands x 3 seeds | -1.1 | 31.1 | -32.1 | 0.2594 | 0.0000 |
| S02 | 300 hands x 3 seeds | -7.0 | 37.0 | -44.0 | 0.2548 | 0.0000 |

## Verdict

`IMPROVED_NOT_READY`

Step4-K succeeds at improving `S01` again without damaging `S02/D01/D02/D03`, but Pro still trails Standard on `D01`, `D02`, `S01`, and `S02`.
