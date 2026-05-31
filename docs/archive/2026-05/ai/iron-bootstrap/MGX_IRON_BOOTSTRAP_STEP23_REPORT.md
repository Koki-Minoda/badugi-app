# MGX Iron Bootstrap Step23 Report

## Summary

Step23 added a frozen benchmark loader, drift detector, and periodic telemetry runner for the 3-variant Iron dry-run benchmark.

The benchmark remains governance-safe:

- `promoted=false`
- `routingChanged=false`
- `priorityFrozen=true`
- `shadowTelemetryEnabled=true`
- `D01 excluded=true`

Current monitoring status is `WARN`, not `FAIL`.
The only warning is a dataset hit-rate drop versus the Step22 baseline in the latest completed monitoring artifact.

## Baseline

| Item | Result |
| --- | --- |
| Baseline dataset | `data/ai/action-value/iron-step15-action-value.jsonl` |
| Frozen priority | `true` |
| Shadow telemetry | `true` |
| Variants | `D02 / S01 / S02` |
| Stable buckets | `3` |
| Verified neighbors | `7` |
| Relaxed sources | `1` |
| promoted | `false` |
| routingChanged | `false` |

## Drift

| Check | Status | Detail |
| --- | --- | --- |
| sameActionRate | PASS | `1 >= 0.99` |
| differentActionRate | PASS | `0 <= 0` |
| Iron-Pro D02 | PASS | `0 >= 0` |
| Iron-Pro S01 | PASS | `0 >= 0` |
| Iron-Pro S02 | PASS | `0 >= 0` |
| datasetHitRateDrop | WARN | baseline `0.0031` -> current `0.0000` |
| deterministicReplay | PASS | `true` |
| invalidReplayCount | PASS | `0` |
| illegal | PASS | `0` |
| freeze | PASS | `0` |
| sourcePriorityOrder | PASS | unchanged |
| D01 exclusion | PASS | `no STABLE_STANDARD_BETTER bucket; STABLE_PRO_BETTER only` |
| promoted | PASS | `false` |
| routingChanged | PASS | `false` |

## Arena

| Item | Result |
| --- | --- |
| Drift status | `WARN` |
| sameActionRate | `1.0000` |
| Iron-Pro D02 | `0.00` |
| Iron-Pro S01 | `0.00` |
| Iron-Pro S02 | `0.00` |
| Dataset hit rate | `0.0000` |
| Deterministic replay | `true` |
| invalidReplayCount | `0` |
| promoted | `false` |
| routingChanged | `false` |

## Notes

The completed Step23 monitoring artifact currently shows a zero-hit dry-run sample, so the run is warning-only rather than failing.

This does not indicate a gameplay or governance regression:

- no routing mutation
- no promotion mutation
- no dataset mutation
- no determinism regression
- no illegal action regression
- no freeze regression

The warning means the periodic monitor should continue and Step24 should focus on telemetry drift interpretation rather than changing benchmark governance.
