# MGX Pro Step4-N Report

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-full-step4m-postpatch.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4m-postpatch.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4m-postpatch.json`
- `reports/ai-eval/pro-vs-standard-20260506-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-300-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-300-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-100-step4n-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-100-step4n-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-100-step4n-detailed.json`

## Evaluation Summary

| Variant | Step4M EV | Step4N EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | --------: | --------: | ----------: | --: | -------: | ------ | ------- |
| D03 | `7.5` | `7.5` | `7.5` | `0.0` | `0.0000` | PASS | IMPROVED_NOT_READY |
| D01 | `-3.0` | `-3.0` | `33.0` | `-36.0` | `0.1311` | PASS | IMPROVED_NOT_READY |
| D02 | `9.2` | `9.2` | `20.8` | `-11.5` | `0.0000` | PASS | IMPROVED_NOT_READY |
| S01 | `-0.3` | `-0.3` | `30.3` | `-30.5` | `0.2631` | PASS | IMPROVED_NOT_READY |
| S02 | `-8.6` | `4.7` | `25.3` | `-20.7` | `0.0000` | PASS | IMPROVED_NOT_READY |

## S02 Focused vs Full

| S02 Spot | Step4M Behavior | Step4N Behavior | EV Impact | Decision |
| -------- | --------------- | --------------- | --------: | -------- |
| Focused `300-hand x 3 seed` | Early weak/trash continues inherit `standard-rule CALL`; value line also trimmed | Early weak/trash `CALL` inheritance blocked; Step4-L/H-style value line restored | `-9.4 -> 8.8` Pro EV, gap `-48.8 -> -12.5` | KEEP |
| Full `100-hand x 3 seed` | Same inherited `CALL` leak plus Step4-M value suppression | Same weak/trash guard, with no extra value suppression | `-8.6 -> 4.7` Pro EV, gap `-47.2 -> -20.7` | KEEP |
| `trashSDA5 4way+` facing-bet `CALL` | Present | Blocked by `call-guard` reasons | Main negative bucket removed | KEEP |
| `premium/strong` final value | Suppressed | Restored | Positive EV line recovered | KEEP |

## S02 Focused Comparison

| Evaluation Set | Pro EV | Standard EV | Gap | Fallback |
| -------------- | -----: | ----------: | --: | -------: |
| Step4-K full baseline | `-5.4` | `35.4` | `-40.8` | `0.2582` |
| Step4-L focused `300-hand x 3 seed` | `-4.6` | `34.6` | `-39.2` | `0.2583` |
| Step4-M focused `300-hand x 3 seed` | `-9.4` | `39.4` | `-48.8` | `0.2585` |
| Step4-N focused `300-hand x 3 seed` | `8.8` | `21.2` | `-12.5` | `0.0000` |

## Notes

- Step4-N restores the profitable S02 value line instead of trimming it further.
- The biggest S02 improvement comes from intercepting weak/trash inherited `CALL`s before they fall through to standard-rule logic.
- No other evaluated variant regressed on the `100-hand x 3 seed` suite.
