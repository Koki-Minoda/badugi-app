# MGX Iron Bootstrap Step25 Report

## Summary

Step25 extended Iron benchmark monitoring from single-run telemetry to persistent governance telemetry.

No gameplay, routing, promotion, or dataset behavior changed.

## Results

| Item | Result |
| --- | --- |
| Raw status | `WARN` |
| Hardened status | `PASS` |
| Rolling status | `WARN` |
| Governance status | `WARN` |
| Trend classification | sparse / no gameplay regression |
| Escalation action | `NO_ACTION` |
| Rolling hit rate | `0.0000` |
| Rolling Iron-Pro gap | `0.0000` |
| Deterministic replay | `true` |
| promoted | `false` |
| routingChanged | `false` |

## Trend

| Metric | Trend |
| --- | --- |
| datasetHitRate | `SPARSE` |
| Iron-Pro gap | `SPARSE` |
| fallbackRate | `STABLE` |
| exactOpportunity | `SPARSE` |

## Escalation

| Trigger | Result |
| --- | --- |
| consecutive FAIL | `0` |
| consecutive WARN | `0` |
| sparse WARN | `NO_ACTION` |

## Governance

Append-only history is enabled at:

- `reports/ai-iron/history/iron-monitor-history.jsonl`

Retention policy:

- keep completed runs: `50`
- keep failures forever: `true`
- keep determinism failures forever: `true`
- history append-only: `true`

## Safety

| Item | Result |
| --- | --- |
| deterministic replay | `true` |
| invalidReplayCount | `0` |
| promoted | `false` |
| routingChanged | `false` |
| D01 excluded | `true` |

## Notes

The initial Step25 governance baseline is seeded from the completed benchmark telemetry artifact and establishes persistence, rolling aggregation, and escalation semantics.

This phase does not change benchmark source priority, dataset rows, routing, or gameplay selection.
