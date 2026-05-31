# MGX Iron Bootstrap Step4 Report

## Summary

| Item | Result |
| ---- | ------ |
| Corpus tag | `iron-step4` |
| Fresh hands | `1000 + 500 + 1000` hands per variant across seeds `20260515/16/17` |
| Replay deterministic | `true` |
| Invalid replay count | `0` |
| Excluded stale replay samples | `1` |
| Stable variants | `D02`, `S02` |
| Dataset rows | `236` |
| Variant coverage | `D02=153`, `S02=83` |
| Max single variant share | `0.6483` |
| okForSupervisedTraining | `true` |
| okForIronCandidate | `false` |
| eligibleForOfflineArena | `false` |
| promoted | `NO` |

## Stable Bucket Summary

| Variant | Bucket | Rows | Confidence |
| ------- | ------ | ---: | ---------: |
| D02 | `strongA5 second-pressure` | 153 | 1.0000 |
| S02 | `strongSDA5 CALL/FOLD/RAISE` (`FOLD -> RAISE`) | 83 | 0.9374 |

## Excluded Noisy Buckets

| Variant | Bucket | Reason |
| ------- | ------ | ------ |
| D01 | `strong27TD late pressure` | `NOISY` despite large sample count. |
| D01 | `medium27TD pressure` | `NOISY`; not safe for positive supervision. |
| D01 | `trash27TD FOLD/CALL verify` | Trash verify bucket excluded by policy. |
| D02 | `trashA5 FOLD/CALL verify` | Trash verify bucket excluded by policy. |
| S01 | `strongSD27 top-end pressure` | `NEEDS_MORE_SAMPLES`; stable gate not met. |
| S01 | `upperMediumSD27 small-pressure` | `NEEDS_MORE_SAMPLES`; too sparse. |
| S01 | `trashSD27 FOLD/CALL verify` | Trash verify bucket excluded by policy. |
| S02 | `premiumSDA5 CALL/RAISE` | Sparse/noisy; not training-safe. |
| S02 | `strongSDA5 CALL/FOLD/RAISE` (`FOLD -> CALL`) | `NOISY`; stable gate not met. |
| S02 | `trashSDA5 FOLD/CALL verify` | Trash verify bucket excluded by policy. |

## Replay Legality Fixes

| Issue | Fixed |
| ----- | ----- |
| raise cap mismatch | yes |
| stale legalActions accepted into dataset | yes |
| invalid replay allowed into positive export | yes |

## Notes

- Replay determinism remained clean on the Step4 audit: `mismatchCount=0`, `invalidReplayCount=0` in the determinism audit runner.
- Counterfactual scoring still observed one stale `RAISE` sample, but it is now pre-filtered out of positive replay accounting and excluded from export. This is why `invalidReplayCount=0` while `excludedInvalidSamples=1`.
- Step4 resolves the `D02-only` dataset blocker, but only reaches **two** stable variants (`D02`, `S02`). The `minimumVariants >= 3` gate therefore still blocks `iron-candidate` / offline arena eligibility.
- No routing or promotion mutation was introduced; `promoted=false`, `eligibleForPromotion=false`, and `routingChanged=false` remain enforced.
