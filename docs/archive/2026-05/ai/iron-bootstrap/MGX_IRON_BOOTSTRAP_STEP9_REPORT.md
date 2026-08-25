# MGX Iron Bootstrap Step9 Report

## Summary

| Item | Result |
| ---- | ------ |
| Arena variants | D02 / S01 / S02 |
| Hands / seeds | 500 hand x 5 seed |
| Dataset hit rate | 0.0056 avg |
| Pro fallback rate | 0.9944 avg |
| Iron-Pro result | all 3 variants positive |
| Iron-Standard result | D02/S01/S02 all positive aggregate |
| D01 included | NO |
| promoted | NO |
| routingChanged | NO |

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | Iron-Standard Gap | HitRate |
| ------- | ------: | -----: | ----------: | -----------: | ----------------: | ------: |
| D02 | 6.90 | 5.30 | -0.26 | 1.60 | 7.16 | 0.0018 |
| S01 | 5.30 | 3.96 | 4.85 | 1.34 | 0.45 | 0.0079 |
| S02 | 6.06 | 4.14 | 5.54 | 1.92 | 0.52 | 0.0070 |

## Seed Stability

| Variant | Mean | 95% CI Lower | 95% CI Upper | Notes |
| ------- | ---: | -----------: | -----------: | ----- |
| D02 | 6.90 | 2.51 | 11.29 | seed 20260527/28 は dataset hit 0 で Pro 同値 |
| S01 | 5.30 | 4.61 | 6.00 | 5 seed 中 4 seed で Iron > Pro |
| S02 | 6.06 | 4.42 | 7.69 | 5 seed 中 4 seed で Iron > Pro |

## Hit Attribution

| Variant | Bucket | Hits | HitRate | Impact |
| ------- | ------ | ---: | ------: | -----: |
| D02 | `strongA5 second-pressure` | 7 | 0.0018 | 794.69 |
| S01 | `strongSD27 top-end pressure` | 24 | 0.0068 | 177.67 |
| S01 | `upperMediumSD27 small-pressure` | 4 | 0.0011 | 18.50 |
| S02 | `strongSDA5 CALL/FOLD/RAISE` | 25 | 0.0070 | 405.71 |

## D01 Exclusion

`D01` は引き続き除外する。理由は `no STABLE_STANDARD_BETTER bucket; STABLE_PRO_BETTER only`。詳細は `MGX_IRON_D01_EXCLUSION_DECISION.md` を参照。

## Interpretation

- Step8 の「Iron > Pro」は Step9 の 500 hand x 5 seed でも再現した。
- hit rate 自体はまだ低いが、hit spot の impact は十分大きい。
- 次に広げるべき対象は、既存 stable bucket の近傍だけでよい。
- D01 は teacher dataset に入れず、別経路で扱う。
