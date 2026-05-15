## Step18 Summary

| Item | Result |
| --- | --- |
| Corpus playerCount | `3` only (`275` samples) |
| Arena playerCount | `6` only (`4249` decisions) |
| Reconciled playerCount | `3` reached in `553` decisions |
| exact opportunities before | `0` |
| exact opportunities after | `0` |
| exact hits after | `0` |
| parity achieved | `NO` |
| deterministic replay | `true` |
| promoted | `false` |
| routingChanged | `false` |

## Timing Table

| Stage | Corpus | Arena Before | Arena After |
| --- | ---: | ---: | ---: |
| active players | `3` | `6` | `6` |
| eligible players | `3`-like replay samples | `0..6` | `0..6` |
| folded reflected | yes, via replay sample accounting | no | yes, for classification only |
| allin reflected | yes, via replay sample accounting | no | yes, for classification only |
| bucket timing | replay-compatible | live seat count | replay-compatible |

## Reconciliation Result

`replay-compatible-playercount` does not mutate gameplay state. It only changes opportunity classification to use betting/pot-eligible participants instead of raw seated players.

- Before reconciliation:
  - `strongSDA5=67`
  - `3way=0`
  - `exact opportunities=0`
- After reconciliation:
  - `strongSDA5 by reconciled playerCount: 3way=1`
  - `playerCountReconciled[3]=553`
  - `exact opportunities=0`

This means the Step17 divergence was real and mostly caused by using raw live seats (`6`) in arena accounting while corpus/replay used a replay-compatible contesting-player count.

## Remaining Mismatch

After reconciliation, the player-count blocker shrank to a residual mismatch set:

| Reason | Count |
| --- | ---: |
| `NO_STRONG_SDA5` | `4182` |
| `PLAYERCOUNT_MISMATCH` | `66` |
| `CALL_BAND_MISMATCH` | `1` |
| `POSITION_MISMATCH` | `0` |
| `PRESSURE_CHAIN_MISMATCH` | `0` |
| `ACTION_ILLEGAL` | `0` |
| `DATASET_ACTION_NOT_LEGAL` | `0` |

So Step18 did not produce an exact opportunity yet, but it reduced the blocker from a full accounting mismatch to a narrow downstream exact-match issue.

## Reconciled Arena

Targeted S02 arena (`20260710`, `3000` hand cap reached before later seeds):

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `S02` | `4.57` | `3.52` | `5.92` | `+1.05` | `0.0040` |

Source contribution:

| Source | Hits | Impact |
| --- | ---: | ---: |
| `stable-bucket` | `13` | `403.05` |
| `verified-neighbor-v1` | `1` | `517.22` |
| `verified-neighbor-v2` | `3` | `343.89` |

No `verified-neighbor-v3-isolated` or `verified-relaxed-match` hits occurred.

## Safety

| Item | Result |
| --- | --- |
| illegal | `0` |
| freeze | `0` |
| invalidReplayCount | `0` |
| D01 excluded | `true` |
| promoted | `false` |
| routingChanged | `false` |

## Conclusion

Step18 reconciled the corpus/arena player-count definition without changing gameplay rules or routing. Exact S02 relaxed opportunities are still absent, but the remaining gap is now a narrow exact-match issue rather than a raw seat-count accounting bug.
