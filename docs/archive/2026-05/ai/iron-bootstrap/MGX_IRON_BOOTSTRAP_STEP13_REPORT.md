# MGX Iron Bootstrap Step13 Report

## Summary

| Item | Result |
| --- | --- |
| Target bucket | `S02 strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated` |
| Original acceptedInvalidReplayCount | 18 |
| Repaired samples | 19 |
| Repair rate | 0.1681 |
| Final acceptedInvalidReplayCount | 0 |
| Exported | NO |
| Deterministic replay | true |
| D01 excluded | YES |
| promoted | false |
| routingChanged | false |

Step13 isolated the Step12 S02 v3 candidate and repaired the stale `RAISE` path without touching production policy. Replay legality was repaired cleanly enough to remove accepted invalid replays, but the bucket still failed the export gate because the repaired counterfactual verdict remained `REJECT_NOISY`.

## Invalid Reason

| Reason | Count |
| --- | ---: |
| stale raise degraded to call (`RAISE_TO_CALL`) | 19 |
| remaining accepted invalid replays | 0 |

The Step12 failure mode was stale raise legality. After refreshed legality checks, the rejected `RAISE` actions could be repaired to `CALL` in 19 cases. No accepted invalid replay remained after repair.

## Repair Summary

| Repair Type | Count |
| --- | ---: |
| `RAISE_TO_CALL` | 19 |

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 6.77 | 3.10 | 11.77 | 3.67 | 0.0070 |
| S01 | 4.08 | 2.64 | 5.08 | 1.44 | 0.0043 |
| S02 | 4.61 | 2.94 | 6.96 | 1.67 | 0.0057 |

## Step12 vs Step13

| Metric | Step12 | Step13 |
| --- | ---: | ---: |
| Dataset rows | 741 | 741 |
| Dataset hit rate | 0.0033 | 0.0057 |
| Pro fallback rate | 0.9967 | 0.9943 |
| S02 Iron-Pro gap | 1.18 | 1.67 |
| S02 Iron-Standard gap | -1.44 | -2.35 |
| Raw invalid replays | 0 | 0 |
| Accepted invalid replays | 18 | 0 |

## S02 v3 Decision

| Bucket | Verdict | Samples | Confidence | Exported |
| --- | --- | ---: | ---: | --- |
| `strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated` | `REJECT_NOISY` | 113 | 1.00 | NO |

Why it stayed out:

- `acceptedInvalidReplayCount` was repaired down to zero.
- `repairRate=0.1681` stayed below the 0.30 ceiling.
- The remaining blocker was verdict quality, not legality: replay still classified the bucket as noisy after repair.

## Safety

| Item | Result |
| --- | --- |
| illegal | 0 |
| freeze | 0 |
| accepted/exported invalidReplayCount | 0 |
| promoted | false |
| routingChanged | false |
| D01 excluded | true |

## Notes

- Step13 determinism audit: `replaySamples=912`, `deterministic=true`, `mismatchCount=0`, `invalidReplayCount=0`.
- `iron-step13-action-value.jsonl` remained identical in row count to Step12 because the S02 v3 candidate did not pass the final export verdict.
- Arena safety and dry-run-only guarantees were preserved. No routing, promotion, or model registry mutation was introduced.
