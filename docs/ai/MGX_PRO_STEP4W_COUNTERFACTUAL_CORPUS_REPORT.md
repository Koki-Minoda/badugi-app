# MGX Step4-W Counterfactual Corpus Report

Source artifacts:
- `reports/ai-eval/divergence-replay-samples/step4w-*.jsonl`
- `reports/ai-eval/counterfactual-score-s02-s01-d02.json`

Executed hands:
- `500` hands x `3` seeds on `D02,S02,S01`
- total targeted corpus hands: `1500` per variant, `4500` hands overall

## Corpus Summary

| Variant | Hands | Samples | Valid Replays | Invalid Replays | Buckets |
| ------- | ----: | ------: | ------------: | --------------: | ------: |
| D02 | 1500 | 9000 | 82 | 0 | 5 |
| S02 | 1500 | 9000 | 85 | 0 | 4 |
| S01 | 1500 | 9000 | 243 | 0 | 4 |

Combined replay sample totals:
- Fresh replay samples written: `27000`
- Filtered counterfactual samples scored: `205`
- Valid replays: `410`
- Invalid replays: `0`

## Bucket Stability

| Variant | Bucket | Samples | Mean Delta | Median Delta | StdDev | Positive Rate | Verdict |
| ------- | ------ | ------: | ---------: | -----------: | -----: | ------------: | ------- |
| D02 | `strongA5 second-pressure` (`FOLD` vs `RAISE`) | 40 | -267.50 | -220.00 | 209.70 | 0.10 | `STABLE_STANDARD_BETTER` |
| S01 | `strongSD27 top-end pressure` (`FOLD` vs `CALL`) | 51 | -57.91 | -50.00 | 59.72 | 0.20 | `STABLE_STANDARD_BETTER` |
| S02 | `strongSDA5 CALL/FOLD/RAISE` (`FOLD` vs `RAISE`) | 29 | -133.10 | -130.00 | 100.59 | 0.14 | `NEEDS_MORE_SAMPLES` |
| S02 | `strongSDA5 CALL/FOLD/RAISE` (`CALL` vs `RAISE`) | 28 | -3.57 | 0.00 | 22.71 | 0.04 | `NOISY` |
| S02 | `premiumSDA5 CALL/RAISE` | 25 | -0.80 | 0.00 | 11.97 | 0.04 | `NOISY` |
| S01 | `upperMediumSD27 small-pressure` | 12 | 0.56 | 0.00 | 14.65 | 0.50 | `NOISY` |
| D02 | `premiumA5 value spots` | 10 | 0.00 | 0.00 | 0.00 | 0.00 | `NOISY` |
| D02 | `trashA5 FOLD/CALL verify` | 492 | -5.33 | -3.33 | 19.67 | 0.40 | `NOISY` |

## Stable Fix Candidates

| Priority | Variant | Bucket | Current Pro Action | Better Action | Confidence | Risk |
| -------- | ------- | ------ | ------------------ | ------------- | ---------- | ---- |
| P0 | D02 | `strongA5 second-pressure` | `FOLD` | `RAISE` in safe second-pressure spots | High | Medium |
| P0 | S01 | `strongSD27 top-end pressure` | `FOLD` | `CALL` under safe top-end pressure | High | Medium |

## Noisy / Do Not Touch

| Variant | Bucket | Reason |
| ------- | ------ | ------ |
| D02 | `trashA5 FOLD/CALL verify` | High sample count but sign is mixed; replay confirms the old weak/trash leak is still noisy and should not be reopened from heuristic intuition. |
| S02 | `premiumSDA5 CALL/RAISE` | Small mean delta and low stability; no clear replay edge yet. |
| S02 | `strongSDA5 CALL/FOLD/RAISE` (`CALL` vs `RAISE`) | Sparse and near-flat; not stable enough for another heuristic exception. |
| S01 | `upperMediumSD27 small-pressure` | Mixed sign and low sample count; not worth reopening medium-defense boundaries yet. |

## Action-value Dataset Candidate

| Variant | Bucket | Samples | Usable for Training | Notes |
| ------- | ------ | ------: | ------------------- | ----- |
| D02 | `strongA5 second-pressure` (`FOLD` vs `RAISE`) | 40 | YES | First stable counterfactual bucket with a strong negative Pro delta. |
| S01 | `strongSD27 top-end pressure` (`FOLD` vs `CALL`) | 51 | YES | Stable bucket; good candidate for same-state action-value labels. |
| S02 | `strongSDA5 CALL/FOLD/RAISE` | 29 | PARTIAL | Direction leans Standard-better, but sample volume is still below the stable threshold. |
| D02 | `trashA5 FOLD/CALL verify` | 492 | NO | Large corpus but too noisy for heuristic repair or training labels without deeper conditioning. |

## Summary

Step4-W achieves the intended separation:
- stable replay-backed buckets now exist for `D02` and `S01`
- `S02` remains sparse and under-sampled in the good-hand buckets that matter
- weak/trash verify buckets stay noisy even with a much larger corpus

That means Step4-X should only consider:
- `D02 strongA5 second-pressure`
- `S01 strongSD27 top-end pressure`

And should explicitly not reopen:
- `D02 trashA5 FOLD/CALL verify`
- `S02 weak/trash guard`
- `S01 weak/trash/medium broad defense`
