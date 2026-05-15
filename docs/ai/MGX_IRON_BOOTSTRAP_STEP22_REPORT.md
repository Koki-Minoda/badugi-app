# MGX Iron Bootstrap Step22 Report

## Freeze Decision

| Item | Result |
| --- | --- |
| freezeRecommended | true |
| sameActionRate | 1.0000 |
| replayOutcomeChanged | 0 |
| overrideWouldChangeGameplay | 0 |
| deterministicReplay | true |
| promoted | false |
| routingChanged | false |

## Priority

| Source | Priority | Mode |
| --- | ---: | --- |
| verified-neighbor-v3-isolated | 3 | active |
| verified-relaxed-match | 4 | shadow-only |

## Governance

| Rule | Enabled |
| --- | --- |
| deterministic replay required | true |
| invalid replay zero required | true |
| shadow neutrality required | true |
| no gameplay mutation | true |
| no routing mutation | true |
| D01 teacher exclusion | true |

## Benchmark Baseline

| Item | Result |
| --- | --- |
| dataset | `data/ai/action-value/iron-step15-action-value.jsonl` |
| variants | `D02/S01/S02` |
| stableBuckets | 3 |
| verifiedNeighbors | 7 |
| relaxedSources | 1 |
| deterministicReplay | true |
| promotionEnabled | false |

Source counts:
- `stable-bucket`: 606
- `verified-neighbor-v1`: 64
- `verified-neighbor-v2`: 71
- `verified-neighbor-v3-isolated`: 239
- `verified-relaxed-match`: 89

## Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | DatasetHitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 3.99 | 2.90 | -2.69 | 1.09 | 0.0020 |
| S01 | 4.14 | 3.32 | 4.54 | 0.82 | 0.0028 |
| S02 | 4.55 | 3.28 | 2.76 | 1.27 | 0.0046 |

Notes:
- `Iron > Pro` held for `D02/S01/S02`.
- `illegal=0`, `freeze=0`.
- `promoted=false`, `routingChanged=false`.
- D01 remained excluded from the teacher dataset and from the benchmark baseline.
