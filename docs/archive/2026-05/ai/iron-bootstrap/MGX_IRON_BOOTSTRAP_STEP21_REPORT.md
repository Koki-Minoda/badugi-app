## Step21 Summary

| Item | Result |
| --- | --- |
| exact opportunities | `6` |
| sameActionRate | `1.0000` |
| differentActionRate | `0.0000` |
| meanEVDelta | `0` |
| gameplayChanged | `false` |
| deterministic replay | `true` |
| promoted | `false` |
| routingChanged | `false` |

## Source

| Source | Hits | Impact | Priority |
| --- | ---: | ---: | ---: |
| isolated | `7` | `511.23` | `3` |
| relaxed | `0` | `shadow-only` | `4` |

## Neutrality

| Metric | Result |
| --- | ---: |
| sameActionCount | `6` |
| differentActionCount | `0` |
| replayOutcomeChanged | `0` |
| overrideWouldChangeGameplay | `0` |

## Arena

| Metric | Result |
| --- | ---: |
| Iron EV | `5.27` |
| Pro EV | `3.82` |
| Standard EV | `6.36` |
| Iron-Pro Gap | `+1.45` |
| DatasetHitRate | `0.0048` |

## Conclusion

Step21 confirms source neutrality under shadow-only analysis.

- exact opportunities increased to `6`
- all `6` relaxed-vs-isolated comparisons produced the same action
- replay neutrality remained unchanged
- simulated priority override would not change gameplay

The remaining difference is attribution-only. Actual selection still prefers `verified-neighbor-v3-isolated`, but changing that priority in simulation would not alter the chosen action for the observed exact opportunities.
