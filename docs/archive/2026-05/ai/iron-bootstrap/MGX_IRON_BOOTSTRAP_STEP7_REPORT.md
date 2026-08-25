# MGX Iron Bootstrap Step7 Report

| Item | Result |
| ---- | ------ |
| Corpus tag | `iron-step7` |
| Replay deterministic | `true` |
| Replay samples | `864` |
| Valid replays | `1728` |
| Invalid replay count | `0` |
| D01 stable dataset buckets | `0` |
| Dataset rows | `649` |
| Stable variants in dataset | `D02, S01, S02` |
| minimumVariants | `3` |
| maxSingleVariantShare | `0.4037` |
| okForSupervisedTraining | `true` |
| okForIronCandidate | `false` |
| eligibleForOfflineArena | `false` |
| eligibleForPromotion | `false` |
| routingChanged | `false` |

## What Stabilized

- `D01 strong27TD late pressure|3way|blind|medium|repeatedPressure|finalRound|rough`
  - `STABLE_PRO_BETTER`
  - not dataset-eligible

## What Did Not Stabilize

- `D01 strong27TD late pressure|3way|IP|medium|repeatedPressure|finalRound|rough`
- `D01 strong27TD late pressure|3way|button|medium|repeatedPressure|finalRound|rough`
- `D01 strong27TD late pressure|3way|OOP|medium|repeatedPressure|finalRound|rough`
- `D01 strong27TD late pressure|4way+|blind|medium|repeatedPressure|finalRound|rough`
- all observed `premium27TD late pressure` sub-buckets

## Dataset Outcome

`iron-step7-action-value.jsonl` was regenerated under the Step7 export gate:

- `verdict == STABLE_STANDARD_BETTER`
- `confidence >= 0.90`
- `signFlipRate <= 0.20`
- deterministic replay only
- invalid replay excluded

Result:

- no D01 rows qualified
- dataset fell back to the `iron-step6` multi-variant base rows
- `minimumVariants >= 4` was **not achieved**

## Safety

- `promoted = false`
- `eligibleForPromotion = false`
- `routingChanged = false`
- replay determinism preserved
- `invalidReplayCount = 0`
- `fallback = 0.0000`
- `illegal / freeze / EV fail = 0`
