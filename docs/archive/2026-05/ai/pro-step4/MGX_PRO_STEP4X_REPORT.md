# MGX Pro Step4-X Report

Source artifacts:
- `reports/ai-eval/counterfactual-score-d02-s01.json`
- `reports/ai-eval/pro-vs-standard-20260506.json`
- `reports/ai-eval/pro-vs-standard-20260507.json`
- `reports/ai-eval/pro-vs-standard-20260508.json`

Step4-X scope was intentionally narrow:
- `D02 strongA5 second-pressure`
- `S01 strongSD27 top-end pressure`

No `S02` heuristics were changed.

## Counterfactual / Aggregate Summary

| Variant | Step4W Gap | Step4X Gap | Counterfactual Delta Before | After | Verdict |
| ------- | ---------: | ---------: | --------------------------: | ----: | ------- |
| D02 targeted `500x3` | `-6.80` | `-7.89` | `-267.50` (`FOLD` vs `RAISE`) | `-267.50` | `REGRESSED` |
| S01 targeted `500x3` | `-11.09` | `-10.17` | `-57.91` (`FOLD` vs `CALL`) | `-57.91` | `IMPROVED_BUT_NOT_STABLE` |
| D02 full-suite `100x3` | `-11.53` | `-11.53` | n/a | n/a | `UNCHANGED` |
| S01 full-suite `100x3` | `-14.00` | `-14.00` | n/a | n/a | `UNCHANGED` |
| D01 full-suite `100x3` | `-2.13` | `-2.13` | n/a | n/a | `UNCHANGED` |
| S02 full-suite `100x3` | `-20.27` | `-20.27` | n/a | n/a | `UNCHANGED` |
| D03 full-suite `100x3` | `0.00` | `0.00` | n/a | n/a | `UNCHANGED` |

## Notes

- Step4-X keeps `fallback = 0.0000` across the target suite.
- `illegal / freeze / EV fail` remain `0`.
- The replay-backed bucket fixes were safe, but they did not improve the historical counterfactual delta because the replay corpus still stores the original divergent action pairs.
- `S01` improves slightly in targeted aggregate, but not enough to move the required full-suite average.
- `D02` does not improve in either counterfactual replay or aggregate evaluation from this narrow fix.

## Outcome

Step4-X validates that:
- replay-backed strong-hand exceptions can be added without reopening weak/trash leaks
- but aggregate EV is now sticky enough that narrow heuristic edits are unlikely to move the suite without a fresh replay corpus or action-value supervision
