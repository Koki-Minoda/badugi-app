# MGX Iron Bootstrap Step2 Dataset Expansion Plan

Goal:
- expand replay-backed action-value supervision beyond the Step4-Y D02-only bootstrap
- keep noisy buckets out of supervised bootstrap rows
- preserve safety while preparing a broader Iron candidate dataset

## Coverage Targets

| Variant | Current Rows | Target Rows | Status | Notes |
| ------- | -----------: | ----------: | ------ | ----- |
| D02 | 40 | 200+ | expand | strongA5中心 |
| S01 | 0 | 100+ | collect | stable bucket探索 |
| S02 | 0 | 100+ | collect | sparse value spot探索 |

## Dataset Inclusion Policy

- stable bucket only for positive supervised rows
- noisy bucket excluded from direct supervised bootstrap
- trash/weak guard buckets are negative-only candidates or excluded entirely
- keep `confidence`, `sampleCount`, `verdict`, `sourceCorpusTag`, and `trainingWeight`

## Known Limits

- Step4-Y export is D02-heavy and sparse
- replay-derived supervision can still be state-dependent even when stable
- S01/S02 remain under-covered until fresh stable buckets appear
- no routing or promotion changes are allowed during Step2

## Step2 Output Intent

- `iron-step2` fresh corpus
- replay-backed counterfactual score for `iron-step2`
- expanded action-value dataset: `data/ai/action-value/iron-step2-action-value.jsonl`
- supervised bootstrap candidate metadata only
