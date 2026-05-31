# MGX Pro Step4-J Report

Seeds: `20260506`, `20260507`, `20260508`  
Focused S01/S02 run: `300` hands per seed  
Full-suite run: `100` hands per variant per seed

| Variant | Step4I Pro EV | Step4J Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -3.0 | -3.0 | 33.0 | -36.0 | 0.1311 | PASS | IMPROVED_NOT_READY |
| D02 | 9.2 | 9.2 | 20.8 | -11.5 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -6.8 | -5.3 | 35.3 | -40.7 | 0.2643 | PASS | IMPROVED_NOT_READY |
| S02 | -5.4 | -5.4 | 35.4 | -40.8 | 0.2582 | PASS | IMPROVED_NOT_READY |

## Notes

- Step4-J keeps the Step4-I `S01` hand-class split and only adjusts `strongSD27` thin value plus bottom-edge `mediumSD27` defense.
- `S01` improves on both the full 3-seed suite and the focused `300`-hand runs.
- `S02`, `D01`, `D02`, and `D03` remain effectively unchanged, which is the intended isolation boundary for this step.

## Focused Single-Draw Check

| Variant | Focused Run | Avg Pro EV | Avg Standard EV | Gap | Fallback | Illegal |
| ------- | ----------: | ---------: | --------------: | --: | -------: | ------: |
| S01 | 300 hands x 3 seeds | -4.0 | 34.0 | -37.9 | 0.2600 | 0.0000 |
| S02 | 300 hands x 3 seeds | -7.0 | 37.0 | -44.0 | 0.2548 | 0.0000 |

## Verdict

`IMPROVED_NOT_READY`

Step4-J succeeds at improving `S01` without damaging `S02/D01/D02/D03`, but Pro still trails Standard on `D01`, `D02`, `S01`, and `S02`.
