# MGX Pro Step4-N S02 Trash-call Guard Report

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-s02-100-step4n-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-100-step4n-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-100-step4n-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-300-step4n.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-300-step4n.json`

## Guard Summary

| Spot | Before | After | Expected Effect | Notes |
| ---- | ------ | ----- | --------------- | ----- |
| `trashSDA5 4way+` facing-bet `CALL` | `standard-rule` `CALL` inheritance present | Guarded to `FOLD/CHECK` with `s02-trash-early-*-call-guard-*` reasons | Remove the largest Step4-M negative bucket | `689` guard hits across the `100-hand x 3 seed` detailed run |
| `weakSDA5 4way+` facing-bet `CALL` | `standard-rule` `CALL` inheritance present | Guarded to `FOLD/CHECK` with `s02-weak-early-*-call-guard-*` reasons | Remove weak `9/T-low` early continues | `50` guard hits across the `100-hand x 3 seed` detailed run |
| `lowerMediumSDA5` multiway `CALL` | Mixed continue behavior under inherited `CALL` | Guarded to `FOLD` on `4way+` pressure and most multiway pressure | Preserve only the smallest, safest continue bucket | `6` explicit `call-guard` hits plus additional non-call-guard pressure folds |
| `premiumSDA5` final value | Step4-M had safety-side suppression | Step4-L/H style value line restored | Recover profitable value bets and small safe raises | `premiumSDA5` remains outside the weak/trash guard |
| `strongSDA5` final value | Step4-M had safety-side suppression | Restored to `BET/CALL` value line with only narrow raise control | Keep profitable value while blocking weak inherited continues | `strongSDA5` remains outside the weak/trash guard |

## Blocked Continue Counts

The evaluation trace payload does not persist `blockedAction`, so Step4-N counts blocked inherited `CALL`s by `call-guard` reasons emitted by the overlay.

| Metric | Count |
| ------ | ----: |
| Total inherited-`CALL` guard hits | 745 |
| `trashSDA5` guard hits | 689 |
| `weakSDA5` guard hits | 50 |
| `lowerMediumSDA5` guard hits | 6 |

## Evaluation Effect

| Evaluation Set | Pro EV | Standard EV | Gap | Fallback |
| -------------- | -----: | ----------: | --: | -------: |
| S02 focused `300-hand x 3 seed` Step4-M | `-9.4` | `39.4` | `-48.8` | `0.2585` |
| S02 focused `300-hand x 3 seed` Step4-N | `8.8` | `21.2` | `-12.5` | `0.0000` |
| S02 full `100-hand x 3 seed` Step4-M | `-8.6` | `38.6` | `-47.2` | `0.2585` |
| S02 full `100-hand x 3 seed` Step4-N | `4.7` | `25.3` | `-20.7` | `0.0000` |

## Notes

- Step4-N confirms the Step4-M diagnosis: the profitable S02 value line did not need more trimming.
- The main improvement comes from blocking early inherited `CALL`s before the weak/trash hand reaches the standard-rule path.
- Safety remains stable at `illegal=0`, `freeze=0`, and `EV fail=0`.
