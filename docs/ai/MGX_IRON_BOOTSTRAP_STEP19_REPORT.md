## Step19 Summary

| Item | Result |
| --- | --- |
| PlayerCount reconciled | `YES` |
| CallBand reconciled | `YES` |
| PressureChain reconciled | `YES` |
| HandClass timing aligned | `PARTIAL` |
| Exact opportunities before | `0` |
| Exact opportunities after | `2` |
| Exact hits after | `0` |
| Dataset rows changed | `NO` |
| deterministic replay | `true` |
| promoted | `false` |
| routingChanged | `false` |

## Mismatch

| Reason | Before | After |
| --- | ---: | ---: |
| `PLAYERCOUNT_MISMATCH` | `66` | `55` |
| `CALL_BAND_MISMATCH` | `1` | `0` |
| `PRESSURE_CHAIN_MISMATCH` | `0` | `0` |
| `HANDCLASS_MISMATCH` | `4182` (`NO_STRONG_SDA5`) | `4178` (`NO_STRONG_SDA5`) |

## Arena

| Metric | Result |
| --- | ---: |
| Iron EV | `4.13` |
| Pro EV | `3.25` |
| Standard EV | `1.63` |
| Iron-Pro Gap | `+0.88` |
| DatasetHitRate | `0.0035` |

## Exact-Match Reconciliation

Step19 added dry-run-only reconciliation for:

- `replay-compatible-playercount`
- `replay-compatible-callband`
- `replay-compatible-pressurechain`

This is classification-only. No gameplay state mutation or routing change was introduced.

### Call band

Corpus `S02 strongSDA5 / playerCount=3` rows were mostly already in the effective `small` family:

- corpus standard bands: `small=241`, `tiny=31`, `medium=3`
- corpus replay-compatible bands: `small=243`, `tiny=29`, `medium=3`

Arena before reconciliation was dominated by `tiny`, which blocked exact matching:

- arena standard bands: `tiny=3839`, `small=390`, `medium=19`, `large=1`

### Pressure chain

Arena raw pressure-chain family was already concentrated in the accepted relaxed family:

- `firstRaiseAfterCall=2739`
- `repeatedPressure=127`
- `delayedPressure=1359`

The remaining issue was not pressure-chain absence, but that `firstRaiseAfterCall` was not being treated as the same repeated-pressure family for the exact matcher.

### Hand class

Corpus contains many more `strongSDA5` rows than live arena:

- corpus `strongSDA5=275`
- arena `strongSDA5=67`

So Step19 confirms a frequency/scarcity issue remains, but no new gameplay-side hand-class mutation was needed.

## Reconciled Targeted Arena

After reconciliation:

- `strongSDA5Decisions=57`
- `playerCount3way=545`
- `exactOpportunities=2`
- `datasetActionLegalCount=2`
- `finalDatasetHits=0`

The no-hit reason is now fixed:

- exact relaxed opportunities do exist
- but both were consumed by stricter `verified-neighbor-v3-isolated` rows
- therefore the relaxed matcher created valid opportunities without becoming the final selected source

That is why:

- `MATCHED_BUT_NOT_SELECTED=2`
- `EXACT_HIT=0`

Attribution confirms the observed hits came from existing clean S02 rows:

| Source | Hits | Impact |
| --- | ---: | ---: |
| `stable-bucket` | `11` | `457.81` |
| `verified-neighbor-v1` | `1` | `807.81` |
| `verified-neighbor-v2` | `1` | `597.81` |
| `verified-neighbor-v3-isolated` | `2` | `397.81` |

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

Step19 resolved the residual exact-match accounting gap enough to create exact S02 relaxed opportunities without changing gameplay or routing. Remaining no-hit behavior is no longer a reconciliation bug; it is a source-priority outcome where narrower isolated rows win over the relaxed row.
