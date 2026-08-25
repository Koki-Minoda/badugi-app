# MGX Iron Bootstrap Step14 Report

## Summary

| Item | Result |
| --- | --- |
| Original verdict | `REJECT_NOISY` |
| Isolation axis | `pressureChain=firstRaiseAfterCall` |
| entropyScore before | 0.2344 |
| entropyScore after | 0.0867 |
| signFlipRate before | 0.1681 |
| signFlipRate after | 0.0476 |
| repairRate | 0.0000 |
| acceptedInvalidReplayCount | 0 |
| Exported | YES |

Step14 kept the Step13 legality repair path intact and focused only on de-noising inside the S02 v3 bucket. The original broad `3way/IP/small/repeated` slice stayed noisy, but single-axis isolation found multiple clean sub-buckets with lower entropy and zero accepted invalid replay.

## Noise Breakdown

| Axis | Value | Delta Stability | Entropy |
| --- | --- | --- | ---: |
| pressureChain | `firstRaiseAfterCall` | stable | 0.0867 |
| pressureChain | `repeatedPressure` | stable | 0.1091 |
| stackDepth | `deep` | stable | 0.1114 |
| position | `cutoff` | stable | 0.2186 |
| toCall | `16-20` | noisy baseline | 0.2344 |
| position | `otherIP` | noisy | 0.2456 |
| pressureChain | `raise-reraise` | unstable | 0.6879 |
| stackDepth | `medium` | unstable | 0.7008 |

## Isolation Verification

| Bucket | Verdict | Samples | Confidence | Exported |
| --- | --- | ---: | ---: | --- |
| `...::pressureChain=firstRaiseAfterCall` | `VERIFIED_EXPORTABLE` | 42 | 0.9524 | YES |
| `...::pressureChain=repeatedPressure` | `VERIFIED_EXPORTABLE` | 47 | 0.9835 | YES |
| `...::stackDepth=deep` | `VERIFIED_EXPORTABLE` | 94 | 1.0000 | YES |
| `...::position=cutoff` | `VERIFIED_EXPORTABLE` | 56 | 1.0000 | YES |
| `...::pressureChain=raise-reraise` | `NEEDS_MORE_SAMPLES` | 24 | 0.1625 | NO |
| `...::stackDepth=medium` | `NEEDS_MORE_SAMPLES` | 19 | 0.1500 | NO |
| `...::toCall=16-20` | `REJECT_NOISY` | 113 | 1.0000 | NO |
| `...::drawStage=draw2` | `REJECT_NOISY` | 113 | 1.0000 | NO |
| `...::position=otherIP` | `REJECT_NOISY` | 57 | 1.0000 | NO |

## Dataset

| Metric | Step13 | Step14 |
| --- | ---: | ---: |
| Dataset rows | 741 | 980 |
| Dataset hit rate | 0.0057 | 0.0047 |
| Pro fallback rate | 0.9943 | 0.9953 |
| S02 hit rate | 0.0057 | 0.0077 |
| Raw invalid replays | 0 | 0 |
| Accepted invalid replays | 0 | 0 |

Step14 exported only the clean isolated S02 sub-buckets. This expanded the dataset by 239 rows while keeping determinism and legality clean. The overall dry-run hit rate fell slightly because the new isolated rows did not meaningfully increase D02/S01 coverage, but S02 local hit rate improved.

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 6.77 | 3.39 | 11.06 | 3.38 | 0.0047 |
| S01 | 5.22 | 4.77 | 7.09 | 0.45 | 0.0017 |
| S02 | 5.81 | 3.20 | 6.56 | 2.61 | 0.0077 |

## Repaired-Hit Impact

Step14 exported isolated buckets with clean legality, but the `verified-neighbor-v3-isolated` rows did not register an arena hit in this 5-seed sample. Observed S02 contribution still came from the pre-existing parent / v1 / v2 rows:

- stable parent: `hits=20`, `impact=451.52`
- verified-neighbor-v1: `hits=3`, `impact=517.52`
- verified-neighbor-v2: `hits=4`, `impact=397.52`
- verified-neighbor-v3-isolated: `hits=0`

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

- Step14 determinism audit resolved to `replaySamples=912`, `deterministic=true`, `mismatchCount=0`, `invalidReplayCount=0`.
- D01 remains excluded from the teacher dataset because it still lacks any `STABLE_STANDARD_BETTER` bucket.
- This step performed replay-backed de-noising only. No routing, promotion, gameplay rule, or model registry mutation was introduced.
