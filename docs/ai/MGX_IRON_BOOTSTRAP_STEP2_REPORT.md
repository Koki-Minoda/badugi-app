# MGX Iron Bootstrap Step2 Report

| Item | Result |
| ---- | ------ |
| Corpus tag | `iron-step2` |
| Fresh hands | `500_hand_x_3_seed` |
| Replay samples | `39624` |
| Counterfactual valid | `15999` |
| Counterfactual invalid | `1` |
| Dataset rows | `87` |
| Valid rows | `87` |
| Variant coverage | `D02:87` |
| Training allowed | `true` |
| Candidate metadata | `YES` |
| Promoted | NO |

## Dataset Bias

| Variant | Rows | Share | Risk |
| ------- | ---: | ----: | ---- |
| D02 | 87 | 100% | high bias |

## Stable Buckets

| Variant | Bucket | Rows | Confidence | Use |
| ------- | ------ | ---: | ---------: | --- |
| D02 | strongA5 second-pressure | 87 | n/a | supervised bootstrap candidate |

## Noisy Buckets Excluded

| Variant | Bucket | Reason |
| ------- | ------ | ------ |
| S01/S02 | noisy replay buckets | excluded from iron-step2 dataset export because verdict was not stable |

## Notes

- Sparse warnings: sparse-dataset, low-variant-coverage, single-variant-bias, d02-heavy-bias
- Remaining limitations: replay-derived supervision remains sparse and D02-heavy.
- Next RL phase: expand stable S01/S02 buckets or move into broader offline policy/value training with additional corpus collection.
- Current stable buckets: strongA5 second-pressure:87.
