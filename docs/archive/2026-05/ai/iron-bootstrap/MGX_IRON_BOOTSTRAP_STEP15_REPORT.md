# MGX Iron Bootstrap Step15 Report

## Summary

| Item | Result |
| --- | --- |
| Isolated rows | 239 |
| Exact opportunities | 0 |
| Near opportunities | 0 |
| Relaxed match exported | YES |
| Deterministic replay | true |
| acceptedInvalidReplayCount | 0 |
| D01 excluded | YES |
| promoted | false |
| routingChanged | false |

## Opportunity

| Reason | Count |
| --- | ---: |
| NO_MATCHING_STATE | 0 |
| PRESSURE_CHAIN_MISMATCH | 0 |
| STACK_DEPTH_MISMATCH | 0 |
| POSITION_MISMATCH | 0 |
| PLAYER_COUNT_MISMATCH | 0 |
| CALL_BAND_MISMATCH | 0 |
| ACTION_ILLEGAL | 0 |
| LEGAL_BUT_NOT_SELECTED | 0 |
| BUCKET_MATCHED | 0 |

Step15 では `verified-neighbor-v3-isolated` / `verified-relaxed-match` の exact state が 5-seed arena に出現しなかった。  
`NO_MATCHING_STATE` 以外の mismatch も発生していないため、現時点の blocker は legality ではなく opportunity scarcity です。

## Relaxed Match

| Candidate | Verdict | Samples | Entropy | RepairRate | Exported |
| --- | --- | ---: | ---: | ---: | --- |
| `pressureChain=firstRaiseAfterCall|repeatedPressure` | `VERIFIED_RELAXED_MATCH` | 89 | 0.1002 | 0.0000 | YES |

Relaxed policy row は `sourceType=verified-relaxed-match` として `89` rows 追加され、dataset は `980 -> 1069` rows へ拡張された。

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 7.97 | 5.28 | 7.11 | 2.69 | 0.0046 |
| S01 | 5.46 | 4.04 | 8.08 | 1.42 | 0.0040 |
| S02 | 6.49 | 4.68 | 5.04 | 1.81 | 0.0059 |

Step14 比では全体平均 `datasetHitRate 0.0047 -> 0.0048`, `proFallbackRate 0.9953 -> 0.9952`。  
`Iron > Pro` は D02/S01/S02 で維持された。

### S02 Attribution

- `stable-bucket`: `hits=14`, `impact=469.87`
- `verified-neighbor-v1`: `hits=2`, `impact=196.30`
- `verified-neighbor-v2`: `hits=5`, `impact=596.30`
- `verified-neighbor-v3-isolated`: `hits=0`
- `verified-relaxed-match`: `hits=0`

Step15 で追加した relaxed row は clean export できたが、arena ではまだ hit していない。

## Safety

| Item | Result |
| --- | --- |
| illegal | 0 |
| freeze | 0 |
| promoted | false |
| routingChanged | false |
| D01 excluded | true |

## Conclusion

Step15 では `S02 3way/IP/small/repeated` の broad noisy bucketを、`pressureChain` 軸の relaxed union として clean export することには成功した。  
一方で arena 上では exact/relaxed opportunity がまだ 0 なので、次段階は matching 条件の追加拡張ではなく、`3way/IP/small/repeated` の live opportunity frequency を増やす sampling 診断が必要です。
