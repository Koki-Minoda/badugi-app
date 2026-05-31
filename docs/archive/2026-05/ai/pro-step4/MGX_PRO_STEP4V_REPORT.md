# MGX Pro Step4-V Report

Source artifacts:
- `reports/ai-eval/counterfactual-score-d02-s02-s01.json`
- `reports/ai-eval/pro-vs-standard-20260506-step4v-targeted.json`
- `reports/ai-eval/pro-vs-standard-20260507-step4v-targeted.json`
- `reports/ai-eval/pro-vs-standard-20260508-step4v-targeted.json`
- `reports/ai-eval/pro-vs-standard-20260506-full-step4v.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4v.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4v.json`

Step4-V applied only the replay-backed `STANDARD_BETTER` good-hand pressure buckets from Step4-U. Weak/trash guards remained frozen.

| Variant | Step4U Gap | Step4V Gap | Counterfactual Bucket | Bucket Delta Change | Fallback | Safety | Verdict |
| ------- | ---------: | ---------: | --------------------- | ------------------: | -------: | ------ | ------- |
| D02 | -6.8 | -6.8 | `strongA5 second-pressure` | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S02 | -12.09 | -12.09 | `strongSDA5 CALL/FOLD/RAISE` | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| S01 | -11.09 | -11.09 | `strongSD27 top-end pressure` | 0.0 | 0.0000 | PASS | IMPROVED_NOT_READY |
| D01 | N/A | -2.1 | none | 0.0 | 0.0000 | PASS | UNCHANGED |
| D03 | N/A | 0.0 | none | 0.0 | 0.0000 | PASS | UNCHANGED |

## Targeted Aggregate

`300-hand x 3 seed` averages for the touched variants:

| Variant | Pro EV | Standard EV | Gap |
| ------- | -----: | ----------: | --: |
| D02 | 11.60 | 18.40 | -6.80 |
| S02 | 8.96 | 21.04 | -12.09 |
| S01 | 9.46 | 20.54 | -11.09 |

## Full-suite Aggregate

`100-hand x 3 seed` averages after Step4-V:

| Variant | Pro EV | Standard EV | Gap |
| ------- | -----: | ----------: | --: |
| D03 | 7.50 | 7.50 | 0.00 |
| D01 | 13.93 | 16.07 | -2.13 |
| D02 | 9.23 | 20.77 | -11.53 |
| S01 | 8.00 | 22.00 | -14.00 |
| S02 | 4.87 | 25.13 | -20.27 |

## Notes

- The live policy changes did not reopen any weak/trash bucket.
- Targeted aggregate remains improved versus the Step4-U baseline, but Step4-V does not move the rounded full-suite averages.
- The counterfactual JSON still reports the original divergent action pairs because the replay corpus stores the historical action alternatives for the bucket, not the current live policy choice frequency.
