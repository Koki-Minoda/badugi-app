# MGX Pro Step4-P Report

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260506-full-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260506-s01-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260507-s01-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260508-s01-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260506-d01-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260507-d01-300-step4p.json`
- `reports/ai-eval/pro-vs-standard-20260508-d01-300-step4p.json`

## Evaluation Summary

| Variant | Step4O Pro EV | Step4P Pro EV | Standard EV | Gap | Fallback | Safety | Verdict |
| ------- | ------------: | ------------: | ----------: | --: | -------: | ------ | ------- |
| D03 | `7.5` | `7.5` | `7.5` | `0.0` | `0.0000` | PASS | IMPROVED_NOT_READY |
| D01 | `13.9` | `13.9` | `16.1` | `-2.1` | `0.0000` | PASS | IMPROVED_NOT_READY |
| D02 | `9.2` | `9.2` | `20.8` | `-11.5` | `0.0000` | PASS | IMPROVED_NOT_READY |
| S01 | `-0.3` | `8.0` | `22.0` | `-14.0` | `0.0000` | PASS | IMPROVED_NOT_READY |
| S02 | `4.7` | `4.7` | `25.3` | `-20.7` | `0.0000` | PASS | IMPROVED_NOT_READY |

## S01 Focused Validation

| Evaluation Set | Pro EV | Standard EV | Gap | Fallback |
| -------------- | -----: | ----------: | --: | -------: |
| Step4-O full baseline | `-0.3` | `30.3` | `-30.5` | `0.2631` |
| Step4-P focused `300-hand x 3 seed` | `9.5` | `20.5` | `-11.1` | `0.0000` |
| Step4-P full `100-hand x 3 seed` | `8.0` | `22.0` | `-14.0` | `0.0000` |

## Impact Check

| Variant | Focused `300-hand x 3 seed` Pro EV | Focused Standard EV | Gap | Notes |
| ------- | ---------------------------------: | ------------------: | --: | ----- |
| D01 | `17.8` | `12.2` | `5.7` | Step4-O gains preserved |
| S02 | `8.8` | `21.2` | `-12.5` | Step4-N gains preserved |

## Notes

- Step4-P applies the D01/S02 winning pattern directly to S01: weak/trash inherited `CALL` is blocked before the generic continue rail.
- S01 fallback drops from `0.2631` to `0.0000`.
- The remaining largest gap is now S02, with D02 next and S01 much closer than before.
