# MGX Iron Bootstrap Step10 Report

## Summary

| Metric | Step9 | Step10 |
| --- | ---: | ---: |
| Dataset rows | 649 | 670 |
| Dataset hit rate | 0.0056 | 0.0047 |
| Pro fallback rate | 0.9944 | 0.9953 |
| D02 Iron-Pro gap | 1.60 | 2.38 |
| S01 Iron-Pro gap | 1.34 | 0.57 |
| S02 Iron-Pro gap | 1.92 | 2.30 |

Step10 expanded only replay-backed stable neighbors. Two neighbors verified cleanly enough to export, and D01 remained excluded.

## Neighbor Summary

| Variant | Parent Stable Bucket | Neighbor Axis | Verdict |
| --- | --- | --- | --- |
| S01 | strongSD27 top-end pressure | toCallBand | VERIFIED_EXPANDABLE |
| S02 | strongSDA5 CALL/FOLD/RAISE | toCallBand | VERIFIED_EXPANDABLE |
| D02 | strongA5 second-pressure | toCallBand / positionBand | NOISY or REJECTED in Step10 sweep |

Verified neighbor buckets:

| Variant | Neighbor Bucket | Confidence | invalidReplayCount |
| --- | --- | ---: | ---: |
| S01 | `strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=repeated` | 1.00 | 0 |
| S02 | `strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=blind::call=small::repeat=repeated` | 1.00 | 0 |

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | Iron-Standard Gap | Dataset Hit Rate | Pro Fallback Rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| D02 | 6.38 | 4.00 | 3.15 | 2.38 | 3.23 | 0.0041 | 0.9959 |
| S01 | 3.64 | 3.07 | 1.86 | 0.57 | 1.78 | 0.0023 | 0.9977 |
| S02 | 6.49 | 4.19 | 2.84 | 2.30 | 3.65 | 0.0079 | 0.9921 |

## Stable vs Neighbor Contribution

| Variant | SourceType | Hits | EV Impact |
| --- | --- | ---: | ---: |
| D02 | stable-bucket | 16 | 833.10 |
| D02 | verified-neighbor | 0 | 0.00 |
| S01 | stable-bucket | 8 | 194.05 |
| S01 | verified-neighbor | 0 | 0.00 |
| S02 | stable-bucket | 21 | 400.29 |
| S02 | verified-neighbor | 7 | 391.45 |

## Safety

| Item | Result |
| --- | --- |
| deterministicReplay | Maintained for exported/accepted rows; raw Step10 verification sweep still contains rejected invalid samples |
| invalidReplayCount | 0 for exported rows; 19 in raw verification sweep |
| illegal | 0 |
| freeze | 0 |
| promoted | false |
| routingChanged | false |

## Notes

- D01 remains excluded from the teacher dataset because it still has no `STABLE_STANDARD_BETTER` bucket.
- Step10 improved S02 by adding one verified neighbor bucket with clean replay support.
- Step10 did not improve aggregate dataset hit rate. The export remained narrow by design.
- The dry-run arena still outperformed Pro on D02, S01, and S02.
