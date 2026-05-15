# MGX Pro Step4-H Report

Seeds: `20260506`, `20260507`, `20260508`  
Focused S02/S01 run: `300` hands per seed  
Full-suite run: `100` hands per variant per seed

| Variant | Step4G Pro EV | Step4H Pro EV | Standard EV | Gap | Frequency Used | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------------- | -------: | ------ | ------- |
| D03 | 7.5 | 7.5 | 7.5 | 0.0 | No | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | -3.0 | -3.0 | 33.0 | -36.0 | No | 0.1311 | PASS | IMPROVED_NOT_READY |
| D02 | 9.2 | 9.2 | 20.8 | -11.5 | No | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -10.4 | -9.6 | 39.6 | -49.2 | No | 0.2653 | PASS | IMPROVED_NOT_READY |
| S02 | -15.0 | -5.4 | 35.4 | -40.8 | No | 0.2582 | PASS | IMPROVED_NOT_READY |

## Notes

- Step4-H keeps `src/ai/pro/frequencyControl.js` in the tree, but removes it from the S02 main decision path. Focused S01/S02 evaluation now reports `frequencyDecisionRate = 0`.
- `S02` recovers materially from the Step4-G regression and also beats the prior Step4-F level (`-9.8 -> -5.4` on the 3-seed 100-hand suite).
- `S01` improves slightly back to its Step4-F level, but still trails Standard badly.
- `D01`, `D02`, and `D03` are effectively unchanged, which is the intended isolation boundary for this step.

## Focused Single-Draw Check

| Variant | Focused Run | Avg Pro EV | Avg Standard EV | Gap | Frequency Decision Rate | Illegal |
| ------- | ----------: | ---------: | --------------: | --: | ----------------------: | ------: |
| S01 | 300 hands x 3 seeds | -9.5 | 39.5 | -49.0 | 0.0000 | 0.0000 |
| S02 | 300 hands x 3 seeds | -7.0 | 37.0 | -44.0 | 0.0000 | 0.0000 |

## Verdict

`IMPROVED_NOT_READY`

Step4-H succeeds at undoing the Step4-G S02 regression and keeps safety/fallback intact, but Pro is still below Standard on `D01`, `D02`, `S01`, and `S02`.
