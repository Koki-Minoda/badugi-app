# MGX Pro Step4-S Report

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-d02-300-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-300-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260508-d02-300-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260506-full-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4s.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4s.json`

| Variant | Step4R Pro EV | Step4S Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | `7.5` | `7.5` | `7.5` | `0.0` | `0.0000` | PASS | STABLE |
| D01 | `13.9` | `13.9` | `16.1` | `-2.1` | `0.0000` | PASS | STABLE |
| D02 | `9.2` | `9.2` | `20.8` | `-11.5` | `0.0000` | PASS | STABLE |
| S01 | `8.0` | `8.0` | `22.0` | `-14.0` | `0.0000` | PASS | STABLE |
| S02 | `4.9` | `4.9` | `25.1` | `-20.3` | `0.0000` | PASS | STABLE |

## D02 Focused Validation

| Evaluation Set | Pro EV | Standard EV | Gap | Fallback |
| -------------- | -----: | ----------: | --: | -------: |
| Step4-O focused `300-hand x 3 seed` | `11.7` | `18.3` | `-6.6` | `0.0000` |
| Step4-S focused `300-hand x 3 seed` | `11.6` | `18.4` | `-6.8` | `0.0000` |
| Step4-S full `100-hand x 3 seed` | `9.2` | `20.8` | `-11.5` | `0.0000` |

## Notes

- Step4-S succeeds as a safety-preserving D02 defense trim, but it does not move the required aggregate.
- The observed `strongA5` repeated-pressure bucket is too sparse in the current suite to materially change `100-hand x 3 seed` EV.
- Experimental Iron readiness does not improve because `D02` stays just outside the `-10` threshold and `S01` / `S02` remain further behind.
