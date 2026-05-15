# MGX Pro Step4-O Report

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260506-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260506-d01-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260507-d01-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260508-d01-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260506-d02-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260507-d02-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260508-d02-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260506-s01-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260507-s01-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260508-s01-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-300-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-300-step4o.json`

## Evaluation Summary

| Variant | Step4N Pro EV | Step4O Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | `7.5` | `7.5` | `7.5` | `0.0` | `0.0000` | PASS | IMPROVED_NOT_READY |
| D01 | `-3.0` | `13.9` | `16.1` | `-2.1` | `0.0000` | PASS | IMPROVED_NOT_READY |
| D02 | `9.2` | `9.2` | `20.8` | `-11.5` | `0.0000` | PASS | IMPROVED_NOT_READY |
| S01 | `-0.3` | `-0.3` | `30.3` | `-30.5` | `0.2631` | PASS | IMPROVED_NOT_READY |
| S02 | `4.7` | `4.7` | `25.3` | `-20.7` | `0.0000` | PASS | IMPROVED_NOT_READY |

## D01 Focused Validation

| Evaluation Set | Pro EV | Standard EV | Gap | Fallback |
| -------------- | -----: | ----------: | --: | -------: |
| Step4-N full baseline | `-3.0` | `33.0` | `-36.0` | `0.1311` |
| Step4-O focused `300-hand x 3 seed` | `17.8` | `12.2` | `5.7` | `0.0000` |
| Step4-O full `100-hand x 3 seed` | `13.9` | `16.1` | `-2.1` | `0.0000` |

## Impact Check

| Variant | Focused `300-hand x 3 seed` Pro EV | Focused Standard EV | Gap | Notes |
| ------- | ---------------------------------: | ------------------: | --: | ----- |
| D02 | `11.7` | `18.3` | `-6.6` | unchanged from Step4-F/Focused |
| S01 | `-1.1` | `31.1` | `-32.1` | unchanged from Step4-K/Focused |
| S02 | `8.8` | `21.2` | `-12.5` | Step4-N gains preserved |

## Notes

- Step4-O removes D01 fallback on the evaluated suite and nearly closes the full-suite gap.
- The core fix is not more aggression; it is cutting inherited or generic late `CALL` rails from weak `rough 8/9-low`, `T-low`, and penalty hands.
- No other evaluated variant regressed on the required `100-hand x 3 seed` suite.
