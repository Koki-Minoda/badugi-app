# MGX Iron Bootstrap Step45 Report

Step45 tested natural mixed exposure recovery for `S02 deep RAISE-vs-CHECK` without promotion, routing changes, dataset overwrite, source-priority changes, gameplay mutation, hidden-state injection, or synthetic opportunity injection.

The natural mixed arena used the Step39 dataset and a deterministic natural table-size schedule (`6max, 6max, 4max, 3way`). The configured run requested `hands=18000`; execution was bounded with `max-hands=1800` to keep the dry-run practical while preserving the configured natural exposure mix.

## Natural Table Exposure

| Table Size | Config Share | Observed Share |
| ---------- | -----------: | -------------: |
| 6max | 0.5000 | 0.5000 |
| 4max | 0.2500 | 0.2500 |
| 3way | 0.2500 | 0.2500 |

Validation: `PASS`

## Exact Opportunity Recovery

| PlayerCount | Opportunities | Hits | HitRate |
| ----------- | ------------: | ---: | ------: |
| 3 | 3 | 3 | 1.0000 |
| 4 | 6 | 6 | 1.0000 |

Step43 mixed baseline: `0` opportunities / `0` hits  
Step45 natural mixed exposure: `9` opportunities / `9` hits

## Arena

| Variant | Iron-Pro Gap | DatasetHitRate |
| ------- | -----------: | -------------: |
| D02 | 1.94 | 0.0022 |
| S01 | 0.85 | 0.0037 |
| S02 | 1.64 | 0.0060 |

Arena safety:

| Metric | Result |
| ------ | ------ |
| illegal | 0 |
| freeze | 0 |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |

## Recovery Gate

| Item | Result |
| ---- | ------ |
| Gate | PASS |
| Reason | natural-exposure-recovered-with-safety-clear |

## Governance

| Item | Result |
| ---- | ------ |
| dataset rows changed | false |
| production dataset changed | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplay mutation | false |
| source priority changed | false |
| model registry mutation | false |
| hidden-state injection | false |
| synthetic opportunity injection | false |

## Artifacts

| Artifact | Path |
| -------- | ---- |
| Natural exposure config | `reports/ai-iron/step45-natural-exposure-config.json` |
| Natural mixed arena | `reports/ai-iron/iron-step45-natural-mixed-arena.json` |
| Exact recovery audit | `reports/ai-iron/step45-exact-opportunity-recovery.json` |
| Table distribution validation | `reports/ai-iron/step45-table-distribution-validation.json` |
| Regression safety | `reports/ai-iron/step45-regression-safety.json` |
| Exposure recovery gate | `reports/ai-iron/step45-exposure-recovery-gate.json` |
| Determinism refresh | `reports/ai-eval/replay-determinism-audit-iron-step45.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step45.json` |

## Conclusion

The Step43 failure mode is recoverable. With natural 3way/4way table exposure included in mixed dry-run composition, `S02 deep RAISE-vs-CHECK` exact opportunities and hits returned without synthetic opportunity creation. All variants remained Iron-Pro positive, illegal/freeze stayed at zero, determinism remained clean, and governance stayed frozen.

Recommended next step: run a larger repeatability version of this natural mixed exposure gate before any gated promotion review.
