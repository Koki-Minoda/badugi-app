# MGX Iron Bootstrap Step3 Report

| Item | Result |
| ---- | ------ |
| Deterministic replay | `true` |
| Invalid replay count | `1` |
| Invalid replay reason | `LEGAL_ACTION_MISMATCH (fixed-limit raise cap reached)` |
| Dataset rows | `87` |
| Variant coverage | `D02:87` |
| okForSupervisedTraining | `true` |
| okForIronCandidate | `false` |
| Promotion changed | NO |

## Determinism

- Replay determinism audit file: `reports/ai-eval/replay-determinism-audit-step3.json`
- Replay samples audited: `500`
- Mismatch count: `0`
- Invalid replay count inside audit: `0`
- Conclusion: replay is deterministic for the audited sample slice.

## Dataset Quality Gate

- Dataset: `data/ai/action-value/iron-step2-action-value.jsonl`
- Validation: `87 / 87 valid`, `0 invalid`
- Quality report: `reports/ai-iron/iron-dataset-quality-step3.json`
- `okForSupervisedTraining=true` because the dataset is valid, deterministic on audit, and non-empty.
- `okForIronCandidate=false` because coverage is still single-variant (`D02` only) and counterfactual replay still has one invalid sample.

## Stable Buckets

| Variant | Bucket | Rows | Confidence | Use |
| ------- | ------ | ---: | ---------: | --- |
| D02 | `strongA5 second-pressure` | 87 | 1.0 | supervised bootstrap only |

## Noisy / Excluded Buckets

| Variant | Bucket | Reason |
| ------- | ------ | ------ |
| D02 | `trashA5 FOLD/CALL verify` | noisy |
| D02 | `premiumA5 value spots` | noisy |
| S01 | `trashSD27 FOLD/CALL verify` | noisy |
| S01 | `strongSD27 top-end pressure` | needs more samples |
| S02 | all current fresh buckets | no stable fresh evidence yet |

## Remaining Limitations

- Dataset remains D02-heavy.
- Counterfactual replay still has one invalid `RAISE` sample caused by fixed-limit raise-cap mismatch.
- S01/S02 have no stable fresh bucket rows yet.

## Next Step

- Continue to Iron Step4 only if the next corpus pass broadens stable rows beyond D02.
- Otherwise, keep this dataset supervised-only and expand S01/S02/D01 corpus before any offline policy learner is treated as an Iron candidate.
