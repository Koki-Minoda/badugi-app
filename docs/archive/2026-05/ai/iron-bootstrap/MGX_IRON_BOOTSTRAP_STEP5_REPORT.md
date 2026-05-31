# MGX Iron Bootstrap Step5 Report

Step5 focuses on variant-balanced corpus expansion and dataset rebalance without changing routing, promotion, or any live AI tier behavior.

## Summary

| Item | Result |
| ---- | ------ |
| Corpus tag | iron-step5 |
| Dataset rows | 448 |
| Stable variants | 3 (`D02`, `S01`, `S02`) |
| Stable buckets | 3 |
| invalidReplayCount | 0 |
| deterministicReplay | true |
| maxSingleVariantShare | 0.3371 |
| minimumVariants | 3 |
| okForSupervisedTraining | true |
| okForIronCandidate | true |
| eligibleForOfflineArena | true |
| promoted | NO |

## Stable Bucket Summary

| Variant | Bucket | Rows | Confidence |
| ------- | ------ | ---: | ---------: |
| D02 | strongA5 second-pressure | 151 | 1.0000 |
| S02 | strongSDA5 CALL/FOLD/RAISE | 146 | 1.0000 |
| S01 | strongSD27 top-end pressure | 151 | 1.0000 |

## Rebalance Summary

| Variant | Raw Share | Rebalanced Share |
| ------- | --------: | ---------------: |
| D02 | 0.3371 | 0.3700 |
| S01 | 0.3371 | 0.2928 |
| S02 | 0.3259 | 0.3372 |

## S01 / D01 Coverage

| Variant | Step4 Stable Rows | Step5 Stable Rows | Status |
| ------- | ----------------: | ----------------: | ------ |
| S01 | 0 | 151 | Added stable coverage |
| D01 | 0 | 0 | Corpus expanded, but still noisy |

## Excluded Noisy Buckets

| Variant | Bucket | Reason |
| ------- | ------ | ------ |
| D01 | strong27TD late pressure | High sample count but unstable sign |
| D01 | medium27TD pressure | Noisy edge |
| D01 | premium27TD late pressure | Too sparse |
| S01 | upperMediumSD27 small-pressure | Confidence below stable threshold |
| S02 | premiumSDA5 CALL/RAISE | Noisy value bucket |
| S02 | strongSDA5 FOLD/CALL | Noisy alternative action pair |
| D02 | premiumA5 value spots | Noisy value bucket |
| D02 | mediumA5 small-pressure | Too sparse |

## Replay Legality Fixes

| Issue | Fixed |
| ----- | ----- |
| raise cap mismatch | yes |

## Notes

- Replay legality alignment now excludes stale raise-cap samples before they count as invalid replays.
- Determinism audit passes with `mismatchCount=0`.
- Step5 clears the Iron candidate quality gate because the dataset now covers three stable variants with no invalid replay rows and low single-variant concentration.
- `D01` remains the next expansion target before any broader offline arena benchmark is considered representative.
- Promotion, routing changes, and `modelRegistry` mutation remain forbidden in this step.
