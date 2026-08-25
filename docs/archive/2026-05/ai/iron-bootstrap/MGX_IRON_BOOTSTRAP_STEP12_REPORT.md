# MGX Iron Bootstrap Step12 Report

## Summary

| Metric | Step11 | Step12 |
| --- | ---: | ---: |
| Dataset rows | 741 | 741 |
| Dataset hit rate | 0.0035 | 0.0033 |
| Pro fallback rate | 0.9966 | 0.9967 |
| S02 hit rate | 0.0051 | 0.0039 |
| S02 neighbor impact | 664.13 | 597.25 |
| Raw invalid replays | 0 | 0 |
| Accepted invalid replays | 0 | 0 |

Step12 refreshed the Step11 determinism gate and explored one more single-axis S02 expansion around the Step11 v2 anchor. No new Step12 v3 row was exported. The best v3 candidate remained negative-EV for Pro but failed the clean export gate because accepted replay invalids were still present after replay.

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 5.12 | 4.02 | -3.38 | 1.10 | 0.0018 |
| S01 | 5.26 | 3.80 | 3.94 | 1.46 | 0.0042 |
| S02 | 4.95 | 3.77 | 6.39 | 1.18 | 0.0039 |

## S02 v3

| Neighbor | Verdict | Samples | Confidence | Exported |
| --- | --- | ---: | ---: | --- |
| `strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated` | REJECTED | 82 | 1.00 | NO |
| `strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=blind::call=small::repeat=repeated` | NEEDS_MORE_SAMPLES | 29 | 0.4966 | NO |
| `strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=button::call=small::repeat=repeated` | NEEDS_MORE_SAMPLES | 16 | 0.3267 | NO |
| `strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=OOP::call=small::repeat=repeated` | REJECTED | 14 | 0.1143 | NO |
| `strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=IP::call=tiny::repeat=repeated` | NEEDS_MORE_SAMPLES | 2 | 0.0250 | NO |

## S01 Opportunity

| Reason | Count |
| --- | ---: |
| noMatchingState | 0 |
| positionMismatch | 0 |
| playerCountMismatch | 0 |
| callBandMismatch | 0 |
| repeatFlagMismatch | 0 |
| actionIllegal | 0 |
| bucketMismatch | 0 |
| legalButNotSelected | 0 |

The exact Step10-exported S01 neighbor again had no observed opportunity in the Step12 arena sample.

## Safety

| Item | Result |
| --- | --- |
| illegal | 0 |
| freeze | 0 |
| promoted | false |
| routingChanged | false |
| D01 excluded | true |

## Notes

- Step11 determinism refresh: `replaySamples=912`, `deterministic=true`, `invalidReplayCount=0`.
- Step12 determinism audit also resolved to `deterministic=true`, `invalidReplayCount=0`.
- Step12 maintained replay-backed, legality-aligned expansion only. No routing, promotion, or model registry mutation was introduced.
- D01 remains excluded from the teacher dataset because there is still no `STABLE_STANDARD_BETTER` teacher bucket.
