# MGX Iron Bootstrap Step11 Report

## Summary

| Metric | Step10 | Step11 |
| --- | ---: | ---: |
| Dataset rows | 670 | 741 |
| Dataset hit rate | 0.0047 | 0.0035 |
| Pro fallback rate | 0.9953 | 0.9966 |
| S02 hit rate | 0.0079 | 0.0051 |
| S02 neighbor impact | 391.45 | 664.13 |
| Raw invalid replays | 19 | 0 |
| Accepted invalid replays | 0 | 0 |

Step11 added one S02 verified neighbor v2, reduced the focused raw invalid sweep to zero, and preserved Iron > Pro on D02/S01/S02. Aggregate hit rate did not improve.

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 5.93 | 4.09 | 10.19 | 1.84 | 0.0029 |
| S01 | 4.54 | 3.86 | 4.22 | 0.68 | 0.0026 |
| S02 | 5.11 | 2.90 | 2.92 | 2.21 | 0.0051 |

## Neighbor

| Variant | Neighbor | Verdict | Hits | Impact |
| --- | --- | --- | ---: | ---: |
| S02 | `strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=IP::call=small::repeat=repeated` | VERIFIED_EXPANDABLE | 3 | 664.13 |
| S02 | `strongSDA5 CALL/FOLD/RAISE::pc=4way+::pos=blind::call=small::repeat=repeated` | verified-neighbor-v1 retained | 4 | 407.46 |
| S01 | `strongSD27 top-end pressure::pc=3way::pos=button::call=small::repeat=repeated` | exported v1, no arena hit in Step11 | 0 | 0.00 |

## Safety

| Item | Result |
| --- | --- |
| illegal | 0 |
| freeze | 0 |
| deterministicReplay | true |
| invalidReplayCount | 0 |
| promoted | false |
| routingChanged | false |
| D01 excluded | true |

## Notes

- Step11 stayed replay-backed. No heuristic overlay or routing change was introduced.
- Step11 determinism audit was refreshed on 2026-05-13 and resolved to `replaySamples=912`, `deterministic=true`, `invalidReplayCount=0`.
- The Step11 S02-focused sweep was clean enough to export one new neighbor v2 bucket.
- S01 exact exported neighbor still did not appear in the Step11 arena sample; only the parent stable bucket hit.
- D01 remains excluded from the teacher dataset.
