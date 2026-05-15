## Step20 Summary

| Item | Result |
| --- | --- |
| exact opportunities | `5` |
| exact hits | `0` |
| selected source | `verified-neighbor-v3-isolated` |
| shadow source | `verified-relaxed-match` |
| specificity delta | `+10.888` |
| same action | `true` |
| different action | `false` |
| deterministic replay | `true` |
| promoted | `false` |
| routingChanged | `false` |

## Priority

| Source | Priority | Specificity |
| --- | ---: | ---: |
| `stable-bucket` | `0` | `17` |
| `verified-neighbor-v1` | `1` | `46` |
| `verified-neighbor-v2` | `2` | `45` |
| `verified-neighbor-v3-isolated` | `3` | `42.886` |
| `verified-relaxed-match` | `4` | `31.998` |

## Source Reconciliation Result

Step20 kept actual selection unchanged and added shadow-only attribution.

- `exact opportunities = 5`
- `datasetActionLegalCount = 5`
- `finalDatasetHits = 0`
- `MATCHED_BUT_NOT_SELECTED = 5`

In every exact opportunity:

- actual selected source: `verified-neighbor-v3-isolated`
- shadow relaxed source: `verified-relaxed-match`
- action chosen by both sources: `RAISE`
- source difference is attribution/specificity, not action semantics

So Step20 confirms that the remaining divergence is not legality or matcher failure. It is a source-priority rule where the narrower isolated row wins over the relaxed row.

## Arena

| Metric | Result |
| --- | ---: |
| Iron EV | `5.68` |
| Pro EV | `2.75` |
| Standard EV | `6.32` |
| Iron-Pro Gap | `+2.93` |
| DatasetHitRate | `0.0064` |

Hit attribution:

| Source | Hits | Impact |
| --- | ---: | ---: |
| `stable-bucket` | `7` | `557.40` |
| `verified-neighbor-v1` | `1` | `717.40` |
| `verified-neighbor-v2` | `4` | `597.40` |
| `verified-neighbor-v3-isolated` | `5` | `557.40` |
| `verified-relaxed-match` | `0` | `shadow-only` |

## Safety

| Item | Result |
| --- | --- |
| illegal | `0` |
| freeze | `0` |
| deterministic replay | `true` |
| invalidReplayCount | `0` |
| D01 excluded | `true` |
| promoted | `false` |
| routingChanged | `false` |

## Conclusion

Step20 fixes the final ambiguity: relaxed rows are not being missed because of matcher or legality issues anymore. They are being shadowed by more specific isolated rows that produce the same legal action. This is a source-attribution difference, not a gameplay difference.
